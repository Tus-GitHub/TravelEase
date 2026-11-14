import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getPublishedCmsPage as readPage, getCmsNavigation as readNavigation } from "./cms";
import { PUBLIC_CMS_CACHE_TAG } from "../cms-cache";

// Keep preview branches and production separate without putting credentials in keys.
const scope = `${process.env.VERCEL_ENV ?? "local"}:${process.env.VERCEL_GIT_COMMIT_REF ?? "development"}`;
const options = { revalidate: 60, tags: [PUBLIC_CMS_CACHE_TAG] };
export const getPublishedCmsPage = cache(unstable_cache(readPage, ["public-cms-page-v1", scope], options));
export const getCmsNavigation = cache(unstable_cache(readNavigation, ["public-cms-navigation-v1", scope], options));
