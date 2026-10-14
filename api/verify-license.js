Last login: Wed Oct 14 02:30:57 on ttys000
pierrejuniorsamuel@Pierres-MacBook-Air ~ % cat /Users/pierrejuniorsamuel/python-practice/bank/boutique-rapo-github/api/verify-license.js
// ═══════════════════════════════════════════════════════════
// API — VERIFYE LISANS CLAIRCASH
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

// ═══ KONFIGIRASYON ═══
const LICENSE_SECRET = 'BR-DEVICE-LICENSE-2026';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ═══ FONKSYON HASH (menm jan ak Master App) ═══
function normalizeDeviceId(id) {
  return String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(8, '0').slice(-8);
}

// ═══ MAP PLAN ═══
const PLAN_MAP = {
  SOLO: { plan: 'solo', maxDevices: 1, price: 250 },
  TEAM: { plan: 'team', maxDevices: 5, price: 500 },
  BOUT: { plan: 'boutique', maxDevices: 10, price: 900 },
  BUSI: { plan: 'business', maxDevices: 99, price: 2500 },
  ENTR: { plan: 'enterprise', maxDevices: 999, price: 0 }
};

// ═══ HANDLER PRENSIPAL ═══
export default async function handler(req, res) {
  // KORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      valid: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { deviceId, code } = req.body || {};

    // ═══ VALIDASYON ═══
    if (!deviceId || !code) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Manke deviceId oswa code' 
      });
    }

    // ═══ NETWAYE KÒD LA ═══
    const cleanCode = String(code).replace(/-/g, '').toUpperCase();
    const prefix = cleanCode.slice(0, 4);
    const hash = cleanCode.slice(4);

    // ═══ VERIFYE PREFIX ═══
    if (!PLAN_MAP[prefix]) {
      return res.status(200).json({ 
        valid: false, 
        error: 'Kòd pa valid' 
      });
    }

    // ═══ REJENERE HASH LA ═══
    const expectedHash = simpleHash(
      normalizeDeviceId(deviceId) + '|' + prefix + '|MW|' + LICENSE_SECRET
    );
    const expectedCode = (prefix + expectedHash).slice(0, 12);

    console.log('🔍 Verifikasyon:');
    console.log('  Device:', normalizeDeviceId(deviceId));
    console.log('  Kòd:', cleanCode);
    console.log('  Atann:', expectedCode);

    // ═══ KONPARE ═══
    if (cleanCode !== expectedCode) {
      return res.status(200).json({ 
        valid: false, 
        error: 'Kòd pa koresponn ak aparèy sa a' 
      });
    }

    // ═══ SI SUPABASE PA KONFIGIRE, AKSEPTE KÒD LA ═══
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('⚠️ Supabase pa konfigire — aksèpte kòd la');
      const planInfo = PLAN_MAP[prefix];
      return res.status(200).json({
        valid: true,
        plan: planInfo.plan,
        maxDevices: planInfo.maxDevices,
        message: 'Kòd valid (san Supabase)'
      });
    }

    // ═══ KONEKTE AK SUPABASE ═══
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const normalizedDevice = normalizeDeviceId(deviceId);
    const planInfo = PLAN_MAP[prefix];

    // ═══ VERIFYE SI LISANS DEJA EGZISTE ═══
    const { data: existing, error: fetchError } = await supabase
      .from('licenses')
      .select('*')
      .eq('device_id', normalizedDevice)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erè fetch:', fetchError);
    }

    // ═══ SI LISANS AKTIF DEJA ═══
    if (existing && existing.status === 'active') {
      const expiresAt = existing.expires_at ? new Date(existing.expires_at) : null;
      
      if (expiresAt && expiresAt > new Date()) {
        // Toujou valid
        console.log('✅ Lisans deja aktif');
        return res.status(200).json({
          valid: true,
          plan: existing.plan,
          maxDevices: existing.max_devices || planInfo.maxDevices,
          expiresAt: existing.expires_at,
          message: 'Lisans deja aktif'
        });
      }
      
      // Ekspire — reaktive
      console.log('🔄 Lisans ekspire — reaktive');
    }

    // ═══ AKTIVE LISANS LAN ═══
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 31); // 31 jou

    const licenseData = {
      device_id: normalizedDevice,
      plan: planInfo.plan,
      status: 'active',
      max_devices: planInfo.maxDevices,
      license_code: code,
      activated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    };

    // Si gen yon non boutik nan existing, kenbe l
    if (existing && existing.shop_name) {
      licenseData.shop_name = existing.shop_name;
    } else {
      licenseData.shop_name = 'Boutique';
    }

    const { error: upsertError } = await supabase
      .from('licenses')
      .upsert(licenseData, { onConflict: 'device_id' });

    if (upsertError) {
      console.error('❌ Erè upsert:', upsertError);
      // Men kòd la valid, kidonk aksepte l
      return res.status(200).json({
        valid: true,
        plan: planInfo.plan,
        maxDevices: planInfo.maxDevices,
        message: 'Kòd valid (erè Supabase)'
      });
    }

    console.log('✅ Lisans aktive pou:', normalizedDevice);
    return res.status(200).json({
      valid: true,
      plan: planInfo.plan,
      maxDevices: planInfo.maxDevices,
      expiresAt: expiresAt.toISOString(),
      message: 'Lisans aktive avèk siksè'
    });

  } catch (err) {
    console.error('❌ Erè jeneral:', err);
    return res.status(500).json({ 
      valid: false, 
      error: 'Erè sèvè: ' + err.message 
    });
  }
}// ═══════════════════════════════════════════════════════════
// API — VERIFYE LISANS CLAIRCASH
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

// ═══ KONFIGIRASYON ═══
const LICENSE_SECRET = 'BR-DEVICE-LICENSE-2026';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ═══ FONKSYON HASH (menm jan ak Master App) ═══
function normalizeDeviceId(id) {
  return String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(8, '0').slice(-8);
}

// ═══ MAP PLAN ═══
const PLAN_MAP = {
  SOLO: { plan: 'solo', maxDevices: 1, price: 250 },
  TEAM: { plan: 'team', maxDevices: 5, price: 500 },
  BOUT: { plan: 'boutique', maxDevices: 10, price: 900 },
  BUSI: { plan: 'business', maxDevices: 99, price: 2500 },
  ENTR: { plan: 'enterprise', maxDevices: 999, price: 0 }
};

// ═══ HANDLER PRENSIPAL ═══
export default async function handler(req, res) {
  // KORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      valid: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { deviceId, code } = req.body || {};

    // ═══ VALIDASYON ═══
    if (!deviceId || !code) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Manke deviceId oswa code' 
      });
    }

    // ═══ NETWAYE KÒD LA ═══
    const cleanCode = String(code).replace(/-/g, '').toUpperCase();
    const prefix = cleanCode.slice(0, 4);
    const hash = cleanCode.slice(4);

    // ═══ VERIFYE PREFIX ═══
    if (!PLAN_MAP[prefix]) {
      return res.status(200).json({ 
        valid: false, 
        error: 'Kòd pa valid' 
      });
    }

    // ═══ REJENERE HASH LA ═══
    const expectedHash = simpleHash(
      normalizeDeviceId(deviceId) + '|' + prefix + '|MW|' + LICENSE_SECRET
    );
    const expectedCode = (prefix + expectedHash).slice(0, 12);

    console.log('🔍 Verifikasyon:');
    console.log('  Device:', normalizeDeviceId(deviceId));
    console.log('  Kòd:', cleanCode);
    console.log('  Atann:', expectedCode);

    // ═══ KONPARE ═══
    if (cleanCode !== expectedCode) {
      return res.status(200).json({ 
        valid: false, 
        error: 'Kòd pa koresponn ak aparèy sa a' 
      });
    }

    // ═══ SI SUPABASE PA KONFIGIRE, AKSEPTE KÒD LA ═══
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('⚠️ Supabase pa konfigire — aksèpte kòd la');
      const planInfo = PLAN_MAP[prefix];
      return res.status(200).json({
        valid: true,
        plan: planInfo.plan,
        maxDevices: planInfo.maxDevices,
        message: 'Kòd valid (san Supabase)'
      });
    }

    // ═══ KONEKTE AK SUPABASE ═══
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const normalizedDevice = normalizeDeviceId(deviceId);
    const planInfo = PLAN_MAP[prefix];

    // ═══ VERIFYE SI LISANS DEJA EGZISTE ═══
    const { data: existing, error: fetchError } = await supabase
      .from('licenses')
      .select('*')
      .eq('device_id', normalizedDevice)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erè fetch:', fetchError);
    }

    // ═══ SI LISANS AKTIF DEJA ═══
    if (existing && existing.status === 'active') {
      const expiresAt = existing.expires_at ? new Date(existing.expires_at) : null;
      
      if (expiresAt && expiresAt > new Date()) {
        // Toujou valid
        console.log('✅ Lisans deja aktif');
        return res.status(200).json({
          valid: true,
          plan: existing.plan,
          maxDevices: existing.max_devices || planInfo.maxDevices,
          expiresAt: existing.expires_at,
          message: 'Lisans deja aktif'
        });
      }
      
      // Ekspire — reaktive
      console.log('🔄 Lisans ekspire — reaktive');
    }

    // ═══ AKTIVE LISANS LAN ═══
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 31); // 31 jou

    const licenseData = {
      device_id: normalizedDevice,
      plan: planInfo.plan,
      status: 'active',
      max_devices: planInfo.maxDevices,
      license_code: code,
      activated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    };

    // Si gen yon non boutik nan existing, kenbe l
    if (existing && existing.shop_name) {
      licenseData.shop_name = existing.shop_name;
    } else {
      licenseData.shop_name = 'Boutique';
    }

    const { error: upsertError } = await supabase
      .from('licenses')
      .upsert(licenseData, { onConflict: 'device_id' });

    if (upsertError) {
      console.error('❌ Erè upsert:', upsertError);
      // Men kòd la valid, kidonk aksepte l
      return res.status(200).json({
        valid: true,
        plan: planInfo.plan,
        maxDevices: planInfo.maxDevices,
        message: 'Kòd valid (erè Supabase)'
      });
    }

    console.log('✅ Lisans aktive pou:', normalizedDevice);
    return res.status(200).json({
      valid: true,
      plan: planInfo.plan,
      maxDevices: planInfo.maxDevices,
      expiresAt: expiresAt.toISOString(),
      message: 'Lisans aktive avèk siksè'
    });

  } catch (err) {
    console.error('❌ Erè jeneral:', err);
    return res.status(500).json({ 
      valid: false, 
      error: 'Erè sèvè: ' + err.message 
    });
  }
}
