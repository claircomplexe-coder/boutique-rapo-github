// ═══════════════════════════════════════════════════════════
// API — VERIFYE LISANS CLAIRCASH (ESM Vèsyon)
// ═══════════════════════════════════════════════════════════
const LICENSE_SECRET = 'BR-DEVICE-LICENSE-2026';

const PLAN_MAP = {
  SOLO: { plan: 'solo', maxDevices: 1 },
  TEAM: { plan: 'team', maxDevices: 5 },
  BOUT: { plan: 'boutique', maxDevices: 10 },
  BUSI: { plan: 'business', maxDevices: 99 },
  ENTR: { plan: 'enterprise', maxDevices: 999 }
};

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ valid: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const deviceId = body.deviceId;
    const code = body.code;

    if (!deviceId || !code) return res.status(400).json({ valid: false, error: 'Missing params' });

    const cleanCode = String(code).replace(/-/g, '').toUpperCase();
    const prefix = cleanCode.slice(0, 4);

    if (!PLAN_MAP[prefix]) return res.status(200).json({ valid: false, error: 'Kod pa valid' });

    const expectedHash = simpleHash(normalizeDeviceId(deviceId) + '|' + prefix + '|MW|' + LICENSE_SECRET);
    const expectedCode = (prefix + expectedHash).slice(0, 12);

    if (cleanCode !== expectedCode) {
      return res.status(200).json({ valid: false, error: 'Kod pa koresponn' });
    }

    const planInfo = PLAN_MAP[prefix];
    return res.status(200).json({
      valid: true,
      plan: planInfo.plan,
      maxDevices: planInfo.maxDevices,
      message: 'Lisans aktif'
    });

  } catch (err) {
    return res.status(500).json({ valid: false, error: err.message });
  }
}
