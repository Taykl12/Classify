import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const email = 'qa.sidebar.anim@example.com';
const { data, error } = await admin.auth.admin.createUser({ email, password: 'QaTest1234!', email_confirm: true, user_metadata: { nombre: 'QA', apellido: 'Sidebar' } });
if (error) { console.log('ERROR', error.message); process.exit(1); }
console.log('CREATED', data.user.id);
const { error: pErr } = await admin.from('usuarios').upsert({ id_usuario: data.user.id, nombre: 'QA', apellido: 'Sidebar', id_rol: 3 });
console.log(pErr ? 'PROFILE_ERROR ' + pErr.message : 'PROFILE_OK');