import { getPool } from './db';
import { hashPassword } from './password';
import { isValidEmail, isValidLatLng, PASSWORD_MIN_LENGTH } from '@/lib/validation';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class DriverError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}

// Account creation and linking are atomic; never claim an existing customer's email.
export async function createDriverLogin(id: number, email: string, password: string, actor: string) {
  email = email.trim().toLowerCase();
  if (!isValidEmail(email) || email.length > 255 || password.length < PASSWORD_MIN_LENGTH || password.length > 200)
    throw new DriverError(400, 'Enter a valid email and a password of 8–200 characters.');
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const d = (await c.query('SELECT * FROM drivers WHERE driver_id=$1 AND NOT is_deleted AND is_active FOR UPDATE', [id])).rows[0];
    if (!d) throw new DriverError(404, 'Active driver not found.');
    if (d.user_id) throw new DriverError(409, 'This driver already has a login.');
    const u = (await c.query(`INSERT INTO users (name,email,phone,password_hash,role_id,email_verified_at,created_by,updated_by)
      VALUES ($1,$2,$3,$4,(SELECT role_id FROM roles WHERE name='driver'),now(),$5,$5) RETURNING user_id`,
      [d.name,email,d.phone,hashPassword(password),actor])).rows[0];
    await c.query('UPDATE drivers SET user_id=$1,updated_by=$2 WHERE driver_id=$3', [u.user_id,actor,id]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    if ((e as {code?: string}).code === '23505') throw new DriverError(409, 'Email is already registered.');
    throw e;
  } finally { c.release(); }
}

export async function removeDriverLogin(id: number, actor: string) {
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const d = (await c.query('SELECT user_id FROM drivers WHERE driver_id=$1 FOR UPDATE', [id])).rows[0];
    if (!d?.user_id) throw new DriverError(404, 'Driver login not found.');
    await c.query('DELETE FROM sessions WHERE user_id=$1', [d.user_id]);
    await c.query(`UPDATE users SET is_active=false,is_deleted=true,password_hash='disabled',updated_by=$2 WHERE user_id=$1`, [d.user_id,actor]);
    await c.query('UPDATE drivers SET user_id=NULL,updated_by=$2 WHERE driver_id=$1', [id,actor]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

const ASSIGNED = `FROM bookings b JOIN drivers d ON d.driver_id=b.driver_id
 JOIN users u ON u.user_id=d.user_id JOIN roles r ON r.role_id=u.role_id
 WHERE d.user_id=$1 AND r.name='driver' AND u.is_active AND NOT u.is_deleted
 AND d.is_active AND NOT d.is_deleted AND NOT b.is_deleted AND b.status IN ('Confirmed','Ongoing')`;
export async function listDriverTrips(userId: string, id?: string) {
  if (id && !UUID.test(id)) return [];
  return (await getPool().query(`SELECT b.booking_id AS id,b.booking_reference AS reference,b.status,
    b.start_datetime AS "startsAt",b.pickup_address AS pickup,b.drop_address AS "drop",
    b.passenger_count AS passengers ${ASSIGNED} ${id ? 'AND b.booking_id=$2' : ''} ORDER BY b.start_datetime`,
    id ? [userId,id] : [userId])).rows;
}

export async function recordLocation(id: string, userId: string, input: Record<string, unknown>) {
  if (!UUID.test(id)) throw new DriverError(404, 'Trip not found.');
  const {lat,lng,accuracy} = input;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidLatLng(lat,lng) ||
      (accuracy != null && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 999999)))
    throw new DriverError(400, 'Invalid location.');
  // Serialize writes per booking, including the rate check. Lock assignment/status
  // so reassignment or completion cannot race a location write.
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const b = (await c.query(`SELECT b.driver_id ${ASSIGNED} AND b.booking_id=$2 AND b.status='Ongoing' FOR UPDATE OF b,d,u`, [userId,id])).rows[0];
    if (!b) throw new DriverError(404, 'No ongoing trip assigned to you.');
    const recent = await c.query(`SELECT 1 FROM driver_locations WHERE booking_id=$1 AND driver_id=$2 AND recorded_at > now()-interval '10 seconds' LIMIT 1`, [id,b.driver_id]);
    if (recent.rowCount) throw new DriverError(429, 'Please wait before sending another location.');
    await c.query('INSERT INTO driver_locations (booking_id,driver_id,lat,lng,accuracy) VALUES ($1,$2,$3,$4,$5)', [id,b.driver_id,lat,lng,accuracy ?? null]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

// Ownership is checked here, not delegated to the UI. Never return previous
// drivers' positions or positions for completed/cancelled trips.
export async function latestLocation(id: string, userId: string) {
  if (!UUID.test(id)) throw new DriverError(404, 'Booking not found.');
  const b = (await getPool().query('SELECT booking_id FROM bookings WHERE booking_id=$1 AND user_id=$2 AND NOT is_deleted', [id,userId])).rows[0];
  if (!b) throw new DriverError(404, 'Booking not found.');
  const row = (await getPool().query(`SELECT l.lat,l.lng,l.accuracy,l.recorded_at AS "recordedAt"
    FROM driver_locations l JOIN bookings b ON b.booking_id=l.booking_id AND b.driver_id=l.driver_id
    JOIN drivers d ON d.driver_id=l.driver_id JOIN users u ON u.user_id=d.user_id
    JOIN roles r ON r.role_id=u.role_id
    WHERE b.booking_id=$1 AND b.user_id=$2 AND NOT b.is_deleted AND b.status='Ongoing'
    AND d.is_active AND NOT d.is_deleted AND u.is_active AND NOT u.is_deleted AND r.name='driver'
    AND l.recorded_at > now()-interval '10 minutes' ORDER BY l.recorded_at DESC,l.location_id DESC LIMIT 1`, [id,userId])).rows[0];
  return row ? {...row,lat:Number(row.lat),lng:Number(row.lng),accuracy:row.accuracy == null ? null : Number(row.accuracy)} : null;
}
