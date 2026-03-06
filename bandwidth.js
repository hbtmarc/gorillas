/* ============================================================
   Gorillas — Bandwidth Analysis & CIDR Utilities
   ============================================================ */

// ───────── CIDR Utilities ─────────
const CIDR_TABLE = {};
for (let p = 0; p <= 32; p++) {
  const total = Math.pow(2, 32 - p);
  const usable = p <= 30 ? total - 2 : (p === 31 ? 2 : 1);
  const maskParts = [];
  let bits = p;
  for (let i = 0; i < 4; i++) {
    const n = Math.min(bits, 8);
    maskParts.push(256 - Math.pow(2, 8 - n));
    bits -= n;
  }
  CIDR_TABLE[p] = { prefix: p, totalIPs: total, usableHosts: usable, mask: maskParts.join('.') };
}

function parseCIDR(str) {
  if (!str) return null;
  const m = str.match(/\/(\d{1,2})\s*$/);
  if (!m) return null;
  const prefix = parseInt(m[1]);
  if (prefix < 0 || prefix > 32) return null;
  return CIDR_TABLE[prefix] || null;
}

function cidrHintHTML(info) {
  if (!info) return '';
  const color = info.usableHosts > 200 ? '#22c55e' : info.usableHosts > 30 ? '#f59e0b' : '#ef4444';
  return `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;color:var(--text-secondary)">
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
    <strong style="color:var(--text-primary)">${info.usableHosts.toLocaleString('pt-BR')}</strong> endereço(s) utilizável(is)
    &nbsp;·&nbsp; Másc. <code style="font-size:10px;background:var(--bg-tertiary);padding:1px 4px;border-radius:3px">${info.mask}</code>
    &nbsp;·&nbsp; /${info.prefix}
  </div>`;
}

// ───────── Bandwidth Parsing ─────────
function parseMbps(str) {
  if (!str) return 0;
  const s = String(str).trim().toLowerCase();
  const m = s.match(/([\d.,]+)\s*(gbps|gbit|g|mbps|mbit|m|kbps|kbit|k)?/i);
  if (!m) return 0;
  let val = parseFloat(m[1].replace(',', '.'));
  if (isNaN(val)) return 0;
  const unit = (m[2] || 'm').charAt(0).toLowerCase();
  if (unit === 'g') val *= 1000;
  if (unit === 'k') val /= 1000;
  return val;
}

// Interface → default speed (Mbps)
const INTERFACE_SPEEDS = {
  'Fast Ethernet (100M)': 100,
  'Gigabit Ethernet': 1000,
  '2.5 GbE': 2500,
  '5 GbE': 5000,
  '10 GbE': 10000,
  'Wi-Fi 4 (N)': 300,
  'Wi-Fi 5 (AC)': 867,
  'Wi-Fi 6 (AX)': 1200,
  'Wi-Fi 6E': 2400,
  'Wi-Fi 7 (BE)': 5000,
  'SFP (1G)': 1000,
  'SFP+ (10G)': 10000,
  'Outro': 0
};

const INTERFACE_OPTIONS = Object.keys(INTERFACE_SPEEDS);

// ───────── Network Balance Calculation ─────────
function calcNetworkBalance(db) {
  const wans = db.wans || [];
  const devices = db.dispositivos || [];

  // Sum WAN throughput
  let wanTotalDown = 0, wanTotalUp = 0;
  wans.forEach(w => {
    wanTotalDown += parseMbps(w.velocidadeDown);
    wanTotalUp += parseMbps(w.velocidadeUp);
  });

  // Analyze device interfaces
  const endpointTypes = ['Access Point', 'Computador', 'PDV/Terminal', 'Impressora', 'Câmera', 'Servidor', 'DVR/NVR', 'Outro'];
  const infraTypes = ['Roteador', 'Switch', 'Firewall', 'Modem ISP'];

  const endpoints = devices.filter(d => endpointTypes.includes(d.tipo) && d.status === 'ativo');
  const infra = devices.filter(d => infraTypes.includes(d.tipo) && d.status === 'ativo');

  // Sum device throughput demand (multiply by quantity for groups)
  let totalDeviceDemand = 0;
  let totalEndpointQty = 0;
  const devicesByInterface = new Map();
  const bottlenecks = [];

  endpoints.forEach(d => {
    const qty = d.quantidade || 1;
    const speedPer = parseMbps(d.velocidade) || (d.interface ? (INTERFACE_SPEEDS[d.interface] || 0) : 0);
    totalDeviceDemand += speedPer * qty;
    totalEndpointQty += qty;
    const ifName = d.interface || 'Não definida';
    const cur = devicesByInterface.get(ifName) || { count: 0, totalSpeed: 0 };
    cur.count += qty;
    cur.totalSpeed += speedPer * qty;
    devicesByInterface.set(ifName, cur);
  });

  // Check infrastructure bottlenecks
  infra.forEach(d => {
    const speed = parseMbps(d.velocidade) || (d.interface ? (INTERFACE_SPEEDS[d.interface] || 0) : 0);
    if (speed > 0 && speed < wanTotalDown) {
      bottlenecks.push({
        device: d.nome,
        reason: `Interface de ${speed} Mbps no ${d.tipo} é menor que WAN total (${wanTotalDown} Mbps)`,
        severity: 'warning'
      });
    }
  });

  // Oversubscription
  const oversubscriptionDown = totalDeviceDemand > 0 ? (totalDeviceDemand / (wanTotalDown || 1)) : 0;
  const oversubscriptionUp = totalDeviceDemand > 0 ? (totalDeviceDemand / (wanTotalUp || 1)) : 0;
  const avgBandwidthPerDevice = totalEndpointQty > 0 ? wanTotalDown / totalEndpointQty : 0;

  // WAN asymmetry warning
  if (wanTotalDown > 0 && wanTotalUp > 0 && wanTotalDown / wanTotalUp > 4) {
    bottlenecks.push({
      device: 'WAN',
      reason: `Upload muito inferior ao download (${wanTotalUp} vs ${wanTotalDown} Mbps). Isso pode afetar VoIP, CFTV remoto e VPN.`,
      severity: 'info'
    });
  }

  return {
    wanTotalDown, wanTotalUp, wanCount: wans.length,
    endpointCount: totalEndpointQty, infraCount: infra.length,
    totalDeviceDemand, devicesByInterface,
    avgBandwidthPerDevice, oversubscriptionDown, oversubscriptionUp,
    bottlenecks
  };
}

// ───────── Render Bandwidth Card ─────────
function renderBandwidthCard(db) {
  const a = calcNetworkBalance(db);
  if (a.wanCount === 0 && a.endpointCount === 0) {
    return `<div class="card" style="margin-top:16px">
      <div class="card-header"><div><h3 class="card-title">Balanço de Rede</h3><p class="card-desc">Cadastre WANs e dispositivos com velocidade de interface para análise.</p></div></div>
    </div>`;
  }

  // Severity color
  const ratioColor = a.oversubscriptionDown <= 2 ? '#22c55e' : a.oversubscriptionDown <= 10 ? '#f59e0b' : '#ef4444';
  const ratioLabel = a.oversubscriptionDown <= 2 ? 'Baixa' : a.oversubscriptionDown <= 10 ? 'Moderada' : 'Alta';

  // Progress bars
  function progressBar(used, total, label) {
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    const c = pct < 50 ? '#22c55e' : pct < 80 ? '#f59e0b' : '#ef4444';
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span>${label}</span><span>${Math.round(pct)}%</span></div>
      <div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${c};border-radius:3px;transition:width .3s ease"></div></div>
    </div>`;
  }

  // Interfaces breakdown
  let ifRows = '';
  a.devicesByInterface.forEach((v, k) => {
    ifRows += `<tr><td style="font-size:12px">${esc(k)}</td><td style="font-size:12px;text-align:center">${v.count}</td><td style="font-size:12px;text-align:right">${v.totalSpeed ? v.totalSpeed.toLocaleString('pt-BR') + ' Mbps' : '—'}</td></tr>`;
  });

  // Bottleneck alerts
  let alertsHTML = '';
  a.bottlenecks.forEach(b => {
    const icon = b.severity === 'warning' ? '⚠️' : 'ℹ️';
    const bg = b.severity === 'warning' ? 'rgba(245,158,11,.08)' : 'rgba(59,130,246,.06)';
    alertsHTML += `<div style="padding:6px 10px;border-radius:6px;background:${bg};font-size:11px;margin-bottom:4px">${icon} <strong>${esc(b.device)}</strong>: ${esc(b.reason)}</div>`;
  });

  return `<div class="card" style="margin-top:16px">
    <div class="card-header"><div><h3 class="card-title">Balanço de Rede</h3><p class="card-desc">Análise de capacidade e gargalos da rede.</p></div></div>
    <div style="padding:0 20px 20px">

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">
        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:8px">
          <div style="font-size:22px;font-weight:700;color:var(--accent)">${a.wanTotalDown}</div>
          <div style="font-size:10px;color:var(--text-tertiary)">Mbps Download (WAN)</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:8px">
          <div style="font-size:22px;font-weight:700;color:var(--accent)">${a.wanTotalUp}</div>
          <div style="font-size:10px;color:var(--text-tertiary)">Mbps Upload (WAN)</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:8px">
          <div style="font-size:22px;font-weight:700">${a.endpointCount}</div>
          <div style="font-size:10px;color:var(--text-tertiary)">Dispositivos finais</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:8px">
          <div style="font-size:22px;font-weight:700;color:${ratioColor}">${a.oversubscriptionDown > 0 ? a.oversubscriptionDown.toFixed(1) + ':1' : '—'}</div>
          <div style="font-size:10px;color:var(--text-tertiary)">Sobrescrita (${ratioLabel})</div>
        </div>
      </div>

      ${a.endpointCount > 0 && a.wanTotalDown > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px">Banda por dispositivo</div>
        <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${a.avgBandwidthPerDevice.toFixed(1)} Mbps</div>
        <div style="font-size:11px;color:var(--text-tertiary)">Média disponível (WAN ÷ dispositivos ativos)</div>
      </div>` : ''}

      ${a.totalDeviceDemand > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px">Utilização teórica</div>
        ${progressBar(a.wanTotalDown, a.totalDeviceDemand, 'Download vs Demanda total')}
        ${progressBar(a.wanTotalUp, a.totalDeviceDemand, 'Upload vs Demanda total')}
      </div>` : ''}

      ${ifRows ? `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px">Interfaces por tipo</div>
        <table style="width:100%"><thead><tr><th style="text-align:left;font-size:11px;font-weight:500;color:var(--text-tertiary)">Interface</th><th style="text-align:center;font-size:11px;font-weight:500;color:var(--text-tertiary)">Qtd</th><th style="text-align:right;font-size:11px;font-weight:500;color:var(--text-tertiary)">Throughput total</th></tr></thead><tbody>${ifRows}</tbody></table>
      </div>` : ''}

      ${alertsHTML ? `
      <div>
        <div style="font-size:12px;font-weight:600;margin-bottom:8px">Alertas</div>
        ${alertsHTML}
      </div>` : '<div style="font-size:11px;color:var(--text-tertiary)">✅ Nenhum gargalo detectado.</div>'}
    </div>
  </div>`;
}
