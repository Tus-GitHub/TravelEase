import { cache } from "react";
import { getPool } from "./db";
import { logActivity } from "./activity-log";
import { CmsError, cmsDefaultDocument, cmsPath, validateCmsDocument, validateCmsSlug, type CmsDocument } from "../cms";
import { isUniqueViolation } from "./db-errors";

export interface CmsPageSummary {
  id: string; slug: string; title: string; status: "draft" | "published"; version: number;
  updatedAt: string; publishedAt: string | null; hasChanges: boolean;
}
export interface CmsPage extends CmsPageSummary { draft: CmsDocument }
export interface CmsRevision { id: string; version: number; createdAt: string }
export interface CmsNavItem { href: string; label: string; header: boolean; footer: boolean; order: number; darkHero?: boolean }
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function cmsPageId(value: string) { if (!UUID.test(value)) throw new CmsError("Page not found.", 404); return value; }
const selectSummary = `page_id,slug,title,status,version,updated_at,published_at,(draft_content IS DISTINCT FROM published_content) AS has_changes`;
function summary(row: Record<string, unknown>): CmsPageSummary {
  return { id: row.page_id as string, slug: row.slug as string, title: row.title as string, status: row.status as CmsPageSummary["status"], version: row.version as number,
    updatedAt: (row.updated_at as Date).toISOString(), publishedAt: row.published_at ? (row.published_at as Date).toISOString() : null, hasChanges: row.has_changes as boolean };
}
export async function listCmsPages(): Promise<CmsPageSummary[]> {
  const result = await getPool().query(`SELECT ${selectSummary} FROM cms_pages WHERE NOT is_deleted ORDER BY CASE slug WHEN 'home' THEN 0 WHEN 'about' THEN 1 ELSE 2 END,updated_at DESC LIMIT 500`);
  return result.rows.map(summary);
}
export async function getCmsPage(id: string): Promise<CmsPage> {
  const result = await getPool().query(`SELECT ${selectSummary},draft_content FROM cms_pages WHERE page_id=$1 AND NOT is_deleted`, [cmsPageId(id)]);
  if (!result.rows[0]) throw new CmsError("Page not found.", 404);
  return { ...summary(result.rows[0]), draft: validateCmsDocument(result.rows[0].draft_content) };
}
function pageTitle(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200) throw new CmsError("Enter a page name of up to 200 characters.");
  return value.trim();
}
export async function createCmsPage(input: { slug?: unknown; title?: unknown; template?: unknown }, actor: string): Promise<CmsPage> {
  const slug = validateCmsSlug(input.slug), title = pageTitle(input.title);
  if (["home", "about"].includes(slug)) throw new CmsError("Open the existing homepage or About page instead.", 409);
  if (input.template !== undefined && !["blank", "home", "about"].includes(String(input.template))) throw new CmsError("Choose a valid page layout.");
  const document = cmsDefaultDocument(input.template === "home" || input.template === "about" ? input.template : slug, title);
  document.seo.title = title;
  document.navigation = { header: false, footer: false, label: title.slice(0, 80), order: 60 };
  try {
    const result = await getPool().query(`INSERT INTO cms_pages(slug,title,draft_content,created_by,updated_by) VALUES($1,$2,$3,$4,$4) RETURNING page_id`, [slug, title, JSON.stringify(validateCmsDocument(document)), actor]);
    const id = result.rows[0].page_id;
    await logActivity({ userId: actor, action: "cms.create", entityType: "cms_page", entityId: id });
    return getCmsPage(id);
  } catch (error) { if (isUniqueViolation(error)) throw new CmsError("That page address is already in use.", 409); throw error; }
}
export async function changeCmsPage(id: string, input: Record<string, unknown>, actor: string): Promise<CmsPage | null> {
  cmsPageId(id);
  const { action, version } = input;
  if (!["save", "publish", "unpublish", "delete", "restore"].includes(String(action)) || !Number.isSafeInteger(version) || Number(version) < 1) throw new CmsError("Invalid page action. Reload the editor.");
  const draft = action === "save" ? validateCmsDocument(input.draft) : null;
  const title = action === "save" ? pageTitle(input.title) : null;
  if (action === "restore" && (typeof input.revisionId !== "string" || !UUID.test(input.revisionId))) throw new CmsError("Choose a valid revision.");
  const client = await getPool().connect();
  let saved: CmsPage | null = null;
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT slug,version,draft_content FROM cms_pages WHERE page_id=$1 AND NOT is_deleted FOR UPDATE", [id]);
    const current = result.rows[0];
    if (!current) throw new CmsError("Page not found.", 404);
    if (current.version !== version) throw new CmsError("This page changed in another editor. Reload it before saving so you don't overwrite their work.", 409);
    if (current.slug === "home" && ["delete", "unpublish"].includes(String(action))) throw new CmsError("The homepage must stay published. Edit its sections instead.");
    if (current.slug === "about" && action === "delete") throw new CmsError("Keep the built-in About page. You can unpublish it instead.");
    if (action === "save") await client.query("UPDATE cms_pages SET title=$2,draft_content=$3,version=version+1,updated_by=$4 WHERE page_id=$1", [id, title, JSON.stringify(draft), actor]);
    if (action === "publish") {
      const content = validateCmsDocument(current.draft_content);
      await client.query("UPDATE cms_pages SET published_content=$2,status='published',published_at=now(),version=version+1,updated_by=$3 WHERE page_id=$1", [id, JSON.stringify(content), actor]);
      await client.query("INSERT INTO cms_page_revisions(page_id,version,content,created_by) VALUES($1,$2,$3,$4)", [id, Number(version) + 1, JSON.stringify(content), actor]);
    }
    if (action === "unpublish") await client.query("UPDATE cms_pages SET status='draft',version=version+1,updated_by=$2 WHERE page_id=$1", [id, actor]);
    if (action === "delete") await client.query("UPDATE cms_pages SET is_deleted=true,is_active=false,status='draft',version=version+1,updated_by=$2 WHERE page_id=$1", [id, actor]);
    if (action === "restore") {
      const revision = await client.query("SELECT content FROM cms_page_revisions WHERE revision_id=$1 AND page_id=$2", [input.revisionId, id]);
      if (!revision.rows[0]) throw new CmsError("Revision not found.", 404);
      await client.query("UPDATE cms_pages SET draft_content=$2,version=version+1,updated_by=$3 WHERE page_id=$1", [id, JSON.stringify(validateCmsDocument(revision.rows[0].content)), actor]);
    }
    if (action !== "delete") {
      const savedRow = (await client.query(`SELECT ${selectSummary},draft_content FROM cms_pages WHERE page_id=$1`, [id])).rows[0];
      saved = { ...summary(savedRow), draft: validateCmsDocument(savedRow.draft_content) };
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  await logActivity({ userId: actor, action: `cms.${action}`, entityType: "cms_page", entityId: id });
  return saved;
}
export async function listCmsRevisions(id: string): Promise<CmsRevision[]> {
  await getCmsPage(id);
  const result = await getPool().query("SELECT revision_id,version,created_at FROM cms_page_revisions WHERE page_id=$1 ORDER BY version DESC LIMIT 50", [id]);
  return result.rows.map(row => ({ id: row.revision_id, version: row.version, createdAt: row.created_at.toISOString() }));
}
/** Read only the published snapshot. No query parameter can enable draft mode. */
export const getPublishedCmsPage = cache(async (slug: string): Promise<CmsDocument | null> => {
  const result = await getPool().query("SELECT published_content,status,is_active,is_deleted FROM cms_pages WHERE slug=$1", [slug]);
  const row = result.rows[0];
  // Defaults support the reviewed migration's initial empty tables; unpublishing
  // an existing About page must never accidentally fall back to its old content.
  if (!row) return ["home", "about"].includes(slug) ? cmsDefaultDocument(slug) : null;
  return row.status === "published" && row.is_active && !row.is_deleted ? validateCmsDocument(row.published_content) : null;
});
export const getCmsNavigation = cache(async (): Promise<CmsNavItem[]> => {
  const result = await getPool().query(`SELECT slug,published_content->'navigation' AS navigation,
    jsonb_path_query_first(published_content, '$.sections[*] ? (@.visible == true)') AS first_section,status,is_active,is_deleted FROM cms_pages
    WHERE (status='published' AND is_active AND NOT is_deleted) OR slug IN ('home','about')`);
  const rows = result.rows;
  for (const slug of ["home", "about"]) if (!rows.some(row => row.slug === slug)) { const document = cmsDefaultDocument(slug); rows.push({ slug, navigation: document.navigation, first_section: document.sections[0], status: "published", is_active: true, is_deleted: false }); }
  return rows.filter(row => row.status === "published" && row.is_active && !row.is_deleted).map(row => ({ href: cmsPath(row.slug), ...row.navigation,
    darkHero: row.first_section?.type === "hero" && !["light", "muted"].includes(row.first_section.appearance?.background),
  })).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
});
