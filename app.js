// ===== APP v5 =====
let _periodoAtual = 'mes'
let _filtroDataAtual = 'tudo'
let _idParaExcluir = null
let _tipoExclusao = 'os'
let _idParaEditar = null

// ===== DRAWER =====
function toggleDrawer() {
  const d = document.getElementById('drawer'), o = document.getElementById('drawer-overlay')
  d.classList.contains('open') ? fecharDrawer() : (d.classList.add('open'), o.classList.add('open'))
}
function fecharDrawer() {
  document.getElementById('drawer').classList.remove('open')
  document.getElementById('drawer-overlay').classList.remove('open')
}

// ===== NAVEGAÇÃO =====
const pageNames = { dashboard:'Dashboard', orcamento:'Orçamento', nova:'Nova OS', historico:'Histórico', relatorios:'Relatórios', precos:'Tabela de Preços', config:'Configurações' }

function abrirTela(id) {
  document.querySelectorAll('.tela').forEach(t => t.style.display = 'none')
  document.getElementById(id).style.display = 'block'
  document.querySelectorAll('.drawer-item').forEach(btn => btn.classList.toggle('active', btn.dataset.page === id))
  document.getElementById('topbar-page-name').textContent = pageNames[id] || ''
  fecharDrawer()
  if (id === 'dashboard') atualizarDashboard()
  if (id === 'historico') atualizarHistorico()
  if (id === 'config') carregarConfigNaTela()
  if (id === 'orcamento') atualizarListaOrcamentos()
  if (id === 'nova') { document.getElementById('resultado').style.display = 'none'; initServicos() }
  if (id === 'relatorios') atualizarRelatorios()
  if (id === 'precos') atualizarListaPrecos()
}

// ===== DASHBOARD =====
function setPeriodo(p, btn) {
  _periodoAtual = p
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  atualizarDashboard()
}

function atualizarDashboard() {
  const historico = filtrarPorPeriodo(getHistorico(), _periodoAtual)
  let faturamento = 0, lucro = 0
  historico.forEach(os => { faturamento += Number(os.valorFinal)||0; lucro += Number(os.lucroReal)||0 })
  const totalOS = historico.length
  const ticketMedio = totalOS > 0 ? faturamento / totalOS : 0

  document.getElementById('dash-faturamento').textContent = fmt(faturamento)
  document.getElementById('dash-lucro').textContent = fmt(lucro)
  document.getElementById('dash-total').textContent = totalOS
  document.getElementById('dash-ticket').textContent = fmt(ticketMedio)

  renderizarMeta(totalOS)
  renderizarStatusBar()
  renderizarGrafico()

  // OS atrasadas (mais de 3 dias em andamento)
  const atrasadas = getHistorico().filter(os => {
    if (os.status === 'entregue' || os.status === 'pronta') return false
    return (new Date() - new Date(os.data)) / 864e5 > 3
  })

  const recentes = getHistorico().slice(0, 5)
  const el = document.getElementById('dash-recentes')

  let alertHtml = ''
  if (atrasadas.length > 0) {
    alertHtml = `<div class="alerta-atraso">⚠️ ${atrasadas.length} OS com mais de 3 dias sem atualização</div>`
  }

  if (recentes.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Nenhuma OS ainda</div><div class="empty-desc">Crie sua primeira OS na aba Nova OS</div></div>`
    return
  }

  el.innerHTML = alertHtml + recentes.map(os => `
    <div class="mini-os-card" onclick="abrirTela('historico')">
      <div class="mini-os-info">
        <div class="mini-os-num">OS #${String(os.numOS||0).padStart(3,'0')}</div>
        <div class="mini-os-cliente">${esc(os.cliente)}</div>
        <div class="mini-os-desc">${esc(os.aparelho)}</div>
        <div class="status-pill ${os.status||'andamento'}">${statusLabel(os.status)}</div>
      </div>
      <div class="mini-os-values">
        <div class="mini-os-valor">${fmt(os.valorFinal)}</div>
        <div class="mini-os-lucro">lucro ${fmt(os.lucroReal)}</div>
      </div>
    </div>`).join('')
}

function renderizarMeta(totalOS) {
  const config = getConfig()
  const el = document.getElementById('dash-meta-wrap')
  if (!config.metaOS || _periodoAtual !== 'mes') { el.innerHTML = ''; return }
  const pct = Math.min(Math.round(totalOS / config.metaOS * 100), 100)
  const cor = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)'
  el.innerHTML = `
    <div class="meta-card">
      <div class="meta-header">
        <span class="meta-label">🎯 Meta mensal</span>
        <span class="meta-num" style="color:${cor}">${totalOS} / ${config.metaOS} OS</span>
      </div>
      <div class="meta-track"><div class="meta-fill" style="width:${pct}%;background:${cor}"></div></div>
      <div class="meta-pct" style="color:${cor}">${pct}% da meta atingida</div>
    </div>`
}

function renderizarStatusBar() {
  const all = getHistorico()
  const counts = { andamento:0, aguardando:0, pronta:0, entregue:0 }
  all.forEach(os => { const s = os.status||'andamento'; if(counts[s]!==undefined) counts[s]++ })
  const total = all.length || 1
  const el = document.getElementById('dash-status-bar')
  if (all.length === 0) { el.innerHTML = ''; return }
  el.innerHTML = `
    <div class="status-overview">
      ${[['andamento','🔧','Andamento'],['aguardando','⏳','Aguardando'],['pronta','✅','Prontas'],['entregue','📦','Entregues']].map(([k,icon,label]) =>
        `<div class="status-stat"><div class="status-stat-num status-${k}">${counts[k]}</div><div class="status-stat-label">${label}</div></div>`).join('')}
    </div>
    <div class="status-bar-track">
      ${['andamento','aguardando','pronta','entregue'].map(k => counts[k]>0 ? `<div class="status-bar-seg status-${k}" style="width:${counts[k]/total*100}%"></div>` : '').join('')}
    </div>`
}

function renderizarGrafico() {
  const historico = getHistorico()
  const el = document.getElementById('grafico-mensal')
  const empty = document.getElementById('grafico-empty')
  if (historico.length === 0) { el.style.display='none'; empty.style.display='block'; return }
  el.style.display='flex'; empty.style.display='none'
  const meses = {}
  const agora = new Date()
  for (let i=5;i>=0;i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth()-i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    meses[key] = { label: d.toLocaleDateString('pt-BR',{month:'short'}), faturamento:0, lucro:0 }
  }
  historico.forEach(os => {
    const d = new Date(os.data)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    if (meses[key]) { meses[key].faturamento += Number(os.valorFinal)||0; meses[key].lucro += Number(os.lucroReal)||0 }
  })
  const dados = Object.values(meses)
  const maxVal = Math.max(...dados.map(d=>d.faturamento), 1)
  el.innerHTML = dados.map(d => `
    <div class="bar-group">
      <div class="bar-wrap">
        <div class="bar bar-fat" style="height:${Math.max(d.faturamento/maxVal*100,2)}%" title="${fmt(d.faturamento)}"></div>
        <div class="bar bar-luc" style="height:${Math.max(d.lucro>0?d.lucro/maxVal*100:0,d.lucro>0?2:0)}%" title="${fmt(d.lucro)}"></div>
      </div>
      <div class="bar-label">${d.label}</div>
    </div>`).join('')
}

function filtrarPorPeriodo(historico, periodo) {
  if (periodo === 'tudo') return historico
  const agora = new Date()
  return historico.filter(os => {
    const d = new Date(os.data)
    if (periodo === 'mes') return d.getMonth()===agora.getMonth() && d.getFullYear()===agora.getFullYear()
    if (periodo === 'semana') return (agora-d)/864e5 <= 7
    return true
  })
}

// ===== HISTÓRICO =====
function setFiltroData(f, btn) {
  _filtroDataAtual = f
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  atualizarHistorico()
}

function filtrarHistorico() { atualizarHistorico() }

function atualizarHistorico() {
  let historico = getHistorico()
  const busca = document.getElementById('search-input')?.value?.toLowerCase() || ''
  const agora = new Date()
  const statusFiltros = ['andamento','aguardando','pronta','entregue']

  if (statusFiltros.includes(_filtroDataAtual)) historico = historico.filter(os => (os.status||'andamento') === _filtroDataAtual)
  else if (_filtroDataAtual === 'hoje') historico = historico.filter(os => new Date(os.data).toDateString() === agora.toDateString())
  else if (_filtroDataAtual === 'semana') historico = historico.filter(os => (agora-new Date(os.data))/864e5 <= 7)
  else if (_filtroDataAtual === 'mes') historico = historico.filter(os => { const d=new Date(os.data); return d.getMonth()===agora.getMonth()&&d.getFullYear()===agora.getFullYear() })

  if (busca) historico = historico.filter(os => os.cliente?.toLowerCase().includes(busca)||os.aparelho?.toLowerCase().includes(busca)||os.servico?.toLowerCase().includes(busca)||(os.numOS&&String(os.numOS).includes(busca)))

  const lista = document.getElementById('lista')
  if (historico.length === 0) {
    lista.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Nenhuma OS encontrada</div><div class="empty-desc">Tente ajustar filtros ou busca</div></div>`
    return
  }

  const pagtLabel = { dinheiro:'💵 Pix/Dinheiro', cartao:'💳 Crédito', debito:'💳 Débito' }
  lista.innerHTML = historico.map(os => {
    const data = new Date(os.data).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
    const status = os.status||'andamento'
    const diasAtras = Math.floor((new Date()-new Date(os.data))/864e5)
    const atrasada = diasAtras > 3 && status !== 'entregue' && status !== 'pronta'
    const servicosDesc = os.servicos ? os.servicos.map(s=>s.nome).join(', ') : (os.servico||'')
    return `
    <div class="os-card${atrasada?' os-card-atrasada':''}" id="os-${os.id}">
      <div class="os-card-header">
        <div>
          <div class="os-num-badge">OS #${String(os.numOS||0).padStart(3,'0')}</div>
          <div class="os-card-cliente">${esc(os.cliente)}</div>
          <div class="os-card-data">${data}${atrasada ? ' · <span style="color:var(--red)">⚠️ '+diasAtras+'d</span>' : ''}</div>
        </div>
        <div class="status-pill ${status}" onclick="ciclarStatus('${os.id}')">${statusLabel(status)}</div>
      </div>
      ${os.foto ? `<img src="${os.foto}" class="os-foto-thumb" onclick="verFoto('${os.id}')" alt="Foto">` : ''}
      <div class="os-card-desc">${esc(os.aparelho)}</div>
      <div class="os-card-servicos">${esc(servicosDesc)}</div>
      ${os.obs ? `<div class="os-obs">📝 ${esc(os.obs)}</div>` : ''}
      ${os.laudoTecnico ? `<div class="os-laudo-badge ${os.laudoTecnico.aprovado?'ok':'fail'}" onclick="verLaudo('${os.id}')">
        ${os.laudoTecnico.aprovado?'✅':'❌'} Laudo técnico · ${os.laudoTecnico.data ? os.laudoTecnico.data.split(',')[0] : new Date(os.data).toLocaleDateString('pt-BR')} <span style="opacity:.6">· ver detalhes</span>
      </div>` : ''}
      <div class="os-card-badge-pagt">${pagtLabel[os.pagamento]||''}</div>
      <div class="os-card-values">
        <div class="os-val-item"><div class="os-val-label">Valor cobrado</div><div class="os-val-num">${fmt(os.valorFinal)}</div></div>
        <div class="os-val-item"><div class="os-val-label">Lucro</div><div class="os-val-num green">${fmt(os.lucroReal)}</div></div>
      </div>
      <div class="os-card-actions">
        ${os.whatsapp ? `<button class="btn-action wpp" onclick="ligarWpp('${os.whatsapp}','${esc(os.cliente)}')">📱 WPP</button>` : `<button class="btn-action wpp" onclick="compartilharOSWpp('${os.id}')">📱 WPP</button>`}
        <button class="btn-action pdf" onclick="gerarPdfOS('${os.id}')">📄 PDF</button>
        <button class="btn-action qr" onclick="abrirQRTeste('${os.id}')">📱 Teste</button>
        <button class="btn-action edit" onclick="abrirModalEdit('${os.id}')">✏️</button>
        <button class="btn-action delete" onclick="abrirModal('${os.id}','os')">🗑️</button>
      </div>
    </div>`
  }).join('')
}

function ligarWpp(numero, cliente) {
  const num = numero.replace(/\D/g,'')
  window.open(`https://wa.me/55${num}`, '_blank')
}

function statusLabel(s) {
  return { andamento:'🔧 Andamento', aguardando:'⏳ Aguardando', pronta:'✅ Pronta', entregue:'📦 Entregue' }[s] || '🔧 Andamento'
}

function ciclarStatus(id) {
  const ordem = ['andamento','aguardando','pronta','entregue']
  const os = getHistorico().find(o => o.id === id)
  if (!os) return
  const prox = ordem[(ordem.indexOf(os.status||'andamento') + 1) % ordem.length]
  editarOS(id, { status: prox })
  atualizarHistorico()
  showToast(`${statusLabel(prox)}`)
}

function verFoto(id) {
  const os = getHistorico().find(o => o.id === id)
  if (!os?.foto) return
  document.getElementById('modal-foto-img').src = os.foto
  document.getElementById('modal-foto-overlay').classList.add('open')
}
function fecharModalFoto() { document.getElementById('modal-foto-overlay').classList.remove('open') }

// ===== ORÇAMENTOS =====
function atualizarListaOrcamentos() {
  const orcs = getOrcamentos()
  const el = document.getElementById('lista-orcamentos')
  if (!el) return
  if (orcs.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Nenhum orçamento</div><div class="empty-desc">Preencha o formulário acima</div></div>`
    return
  }
  el.innerHTML = orcs.map(orc => {
    const data = new Date(orc.data).toLocaleDateString('pt-BR')
    const venc = new Date(orc.data); venc.setDate(venc.getDate() + orc.validade)
    const venceu = new Date() > venc && orc.statusOrc === 'pendente'
    const badge = orc.statusOrc==='aprovado' ? '✅ Aprovado' : venceu ? '❌ Vencido' : '⏳ Pendente'
    return `
    <div class="os-card">
      <div class="os-card-header">
        <div>
          <div class="os-card-cliente">${esc(orc.cliente)}</div>
          <div class="os-card-data">${data} · válido até ${venc.toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="orc-status-badge ${orc.statusOrc}">${badge}</div>
      </div>
      <div class="os-card-desc">${esc(orc.aparelho)} · ${esc(orc.servico)}</div>
      <div class="os-card-values">
        <div class="os-val-item"><div class="os-val-label">Valor</div><div class="os-val-num">${fmt(orc.valorFinal)}</div></div>
        <div class="os-val-item"><div class="os-val-label">Lucro est.</div><div class="os-val-num green">${fmt(orc.lucroReal)}</div></div>
      </div>
      <div class="os-card-actions">
        <button class="btn-action wpp" onclick="compartilharOrcWpp('${orc.id}')">📱 WPP</button>
        ${orc.statusOrc!=='aprovado' ? `<button class="btn-action edit" onclick="orcamentoVirarOS('${orc.id}')">✅ Aprovar OS</button>` : ''}
        <button class="btn-action delete" onclick="abrirModal('${orc.id}','orc')">🗑️</button>
      </div>
    </div>`
  }).join('')
}

// ===== RELATÓRIOS =====
function atualizarRelatorios() {
  const historico = getHistorico()
  const el = document.getElementById('relatorios-content')
  if (historico.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Sem dados ainda</div><div class="empty-desc">As análises aparecem após registrar OS</div></div>`
    return
  }

  // Serviços mais feitos
  const servicoCount = {}
  historico.forEach(os => {
    const svcs = os.servicos ? os.servicos.map(s=>s.nome) : [os.servico||'Sem nome']
    svcs.forEach(s => { servicoCount[s] = (servicoCount[s]||0) + 1 })
  })
  const topServicos = Object.entries(servicoCount).sort((a,b)=>b[1]-a[1]).slice(0,5)

  // Aparelhos mais comuns
  const aparelhoCount = {}
  historico.forEach(os => { const a = os.aparelho||'Desconhecido'; aparelhoCount[a] = (aparelhoCount[a]||0)+1 })
  const topAparelhos = Object.entries(aparelhoCount).sort((a,b)=>b[1]-a[1]).slice(0,5)

  // Melhor dia da semana
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const diaCount = [0,0,0,0,0,0,0]
  historico.forEach(os => diaCount[new Date(os.data).getDay()]++)
  const melhorDia = dias[diaCount.indexOf(Math.max(...diaCount))]

  // Forma de pagamento
  const pagtCount = { dinheiro:0, cartao:0, debito:0 }
  historico.forEach(os => { if(pagtCount[os.pagamento]!==undefined) pagtCount[os.pagamento]++ })

  // Totais gerais
  let totalFat = 0, totalLucro = 0
  historico.forEach(os => { totalFat += Number(os.valorFinal)||0; totalLucro += Number(os.lucroReal)||0 })
  const margemMedia = totalFat > 0 ? (totalLucro/totalFat*100).toFixed(1) : 0

  el.innerHTML = `
    <div class="rel-card">
      <div class="form-section-label">📊 Resumo geral</div>
      <div class="rel-row"><span>Total de OS</span><strong>${historico.length}</strong></div>
      <div class="rel-row"><span>Total faturado</span><strong>${fmt(totalFat)}</strong></div>
      <div class="rel-row"><span>Lucro total</span><strong style="color:var(--green)">${fmt(totalLucro)}</strong></div>
      <div class="rel-row"><span>Margem média</span><strong>${margemMedia}%</strong></div>
      <div class="rel-row"><span>Melhor dia</span><strong>${melhorDia}</strong></div>
    </div>

    <div class="rel-card">
      <div class="form-section-label">🔧 Serviços mais realizados</div>
      ${topServicos.map(([nome,qtd],i) => `
        <div class="rel-rank-item">
          <span class="rel-rank-pos">${i+1}</span>
          <span class="rel-rank-nome">${esc(nome)}</span>
          <span class="rel-rank-val">${qtd}x</span>
        </div>`).join('')}
    </div>

    <div class="rel-card">
      <div class="form-section-label">📱 Aparelhos mais comuns</div>
      ${topAparelhos.map(([nome,qtd],i) => `
        <div class="rel-rank-item">
          <span class="rel-rank-pos">${i+1}</span>
          <span class="rel-rank-nome">${esc(nome)}</span>
          <span class="rel-rank-val">${qtd}x</span>
        </div>`).join('')}
    </div>

    <div class="rel-card">
      <div class="form-section-label">💳 Formas de pagamento</div>
      <div class="rel-row"><span>💵 Dinheiro/Pix</span><strong>${pagtCount.dinheiro} OS</strong></div>
      <div class="rel-row"><span>💳 Cartão Crédito</span><strong>${pagtCount.cartao} OS</strong></div>
      <div class="rel-row"><span>💳 Cartão Débito</span><strong>${pagtCount.debito} OS</strong></div>
    </div>`
}

// ===== MODAIS =====
function abrirModal(id, tipo) { _idParaExcluir=id; _tipoExclusao=tipo; document.getElementById('modal-overlay').classList.add('open') }
function fecharModal() { document.getElementById('modal-overlay').classList.remove('open'); _idParaExcluir=null }
function confirmarExclusao() {
  if (!_idParaExcluir) return
  _tipoExclusao==='orc' ? (excluirOrcamento(_idParaExcluir), atualizarListaOrcamentos()) : (excluirOS(_idParaExcluir), atualizarHistorico())
  fecharModal(); showToast('🗑️ Excluído')
}

function abrirModalEdit(id) {
  const os = getHistorico().find(o => o.id === id)
  if (!os) return
  _idParaEditar = id
  document.getElementById('edit-cliente').value = os.cliente||''
  document.getElementById('edit-whatsapp').value = os.whatsapp||''
  document.getElementById('edit-aparelho').value = os.aparelho||''
  document.getElementById('edit-servico').value = os.servico || (os.servicos?.[0]?.nome||'')
  document.getElementById('edit-obs').value = os.obs||''
  document.getElementById('edit-status').value = os.status||'andamento'
  document.getElementById('modal-edit-overlay').classList.add('open')
}
function fecharModalEdit() { document.getElementById('modal-edit-overlay').classList.remove('open'); _idParaEditar=null }
function confirmarEdicao() {
  if (!_idParaEditar) return
  const campos = {
    cliente: document.getElementById('edit-cliente').value.trim(),
    whatsapp: document.getElementById('edit-whatsapp').value.trim(),
    aparelho: document.getElementById('edit-aparelho').value.trim(),
    servico: document.getElementById('edit-servico').value.trim(),
    obs: document.getElementById('edit-obs').value.trim(),
    status: document.getElementById('edit-status').value
  }
  if (!campos.cliente||!campos.aparelho) { showToast('⚠️ Preencha os campos obrigatórios'); return }
  editarOS(_idParaEditar, campos)
  fecharModalEdit(); atualizarHistorico(); showToast('✅ OS atualizada!')
}

function fecharModalPdf() { document.getElementById('modal-pdf-overlay').classList.remove('open') }

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg; t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 2800)
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// ===== RECEBER LAUDO DO TESTE =====
function aplicarLaudo(payload) {
  if (!payload || !payload.osId) return
  const historico = getHistorico()
  const idx = historico.findIndex(o => o.id === payload.osId)
  if (idx === -1) return
  historico[idx].laudoTecnico = payload
  historico[idx].status = 'pronta'
  localStorage.setItem('lt_historico', JSON.stringify(historico))
  // Remove pendente
  try { localStorage.removeItem('lt_laudo_pendente') } catch(e) {}
  showToast('✅ Laudo recebido! OS marcada como Pronta')
  // Atualiza tela se estiver no histórico
  if (document.getElementById('historico').style.display !== 'none') atualizarHistorico()
  if (document.getElementById('dashboard').style.display !== 'none') atualizarDashboard()
}

// Escuta BroadcastChannel (tempo real, mesma aba/origem)
try {
  const ch = new BroadcastChannel('lucrotech_laudo')
  ch.onmessage = e => {
    if (e.data?.type === 'LAUDO_PRONTO') aplicarLaudo(e.data.payload)
  }
} catch(e) {}

// Escuta visibilitychange — quando voltar ao app lê laudo pendente
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    try {
      const raw = localStorage.getItem('lt_laudo_pendente')
      if (raw) aplicarLaudo(JSON.parse(raw))
    } catch(e) {}
  }
})

// Escuta storage event — quando outra aba escreve no localStorage
window.addEventListener('storage', e => {
  if (e.key === 'lt_laudo_pendente' && e.newValue) {
    try { aplicarLaudo(JSON.parse(e.newValue)) } catch(err) {}
  }
  if (e.key === 'lt_historico') {
    // histórico mudou em outra aba — recarrega
    if (document.getElementById('historico').style.display !== 'none') atualizarHistorico()
  }
})

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  // Checa laudo pendente ao abrir
  try {
    const raw = localStorage.getItem('lt_laudo_pendente')
    if (raw) aplicarLaudo(JSON.parse(raw))
  } catch(e) {}
  abrirTela('dashboard')
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')
})

// ===== QR TESTE =====
let _qrTesteLink = ''
let _qrOsId = ''

function abrirQRTeste(osId) {
  const os = getHistorico().find(o => o.id === osId)
  if (!os) return
  gerarQRTeste(os)
}

function gerarQRTeste(os) {
  const base = location.origin + location.pathname.replace('index.html','').replace(/\/?$/, '/')
  const svcs = os.servicos ? os.servicos.map(s=>s.nome).join(', ') : (os.servico||'')
  const params = new URLSearchParams({
    num: String(os.numOS||'').padStart(3,'0'),
    c: os.cliente || '',
    a: os.aparelho || '',
    s: svcs.substring(0, 60),
    id: os.id
  })
  if (os.whatsapp) params.set('w', os.whatsapp)
  _qrTesteLink = `${base}teste.html?${params.toString()}`
  _qrOsId = os.id

  const container = document.getElementById('qr-container')
  container.innerHTML = ''
  try {
    new QRCode(container, {
      text: _qrTesteLink,
      width: 220, height: 220,
      colorDark: '#0f172a', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    })
  } catch(e) {
    container.innerHTML = `<p style="color:var(--red);font-size:13px">Erro ao gerar QR.</p>`
  }

  document.getElementById('qr-link-wrap').textContent = _qrTesteLink
  document.getElementById('modal-qr-overlay').classList.add('open')
}

function fecharModalQR() {
  document.getElementById('modal-qr-overlay').classList.remove('open')
}

// Abre o teste dentro do app via iframe (mesmo localStorage = laudo salva direto)
function abrirTesteInterno() {
  fecharModalQR()
  const overlay = document.getElementById('iframe-teste-overlay')
  const iframe  = document.getElementById('iframe-teste')
  iframe.src = _qrTesteLink
  overlay.style.display = 'flex'

  // Escuta mensagem do iframe quando o teste terminar
  window._testeListener = function(e) {
    if (e.data?.type === 'LAUDO_PRONTO') {
      aplicarLaudo(e.data.payload)
      fecharTesteInterno()
    }
  }
  window.addEventListener('message', window._testeListener)
}

function fecharTesteInterno() {
  const overlay = document.getElementById('iframe-teste-overlay')
  const iframe  = document.getElementById('iframe-teste')
  overlay.style.display = 'none'
  iframe.src = ''
  if (window._testeListener) {
    window.removeEventListener('message', window._testeListener)
    window._testeListener = null
  }
  // Verifica se laudo chegou via localStorage
  try {
    const raw = localStorage.getItem('lt_laudo_pendente')
    if (raw) aplicarLaudo(JSON.parse(raw))
  } catch(e) {}
  atualizarHistorico()
}

// Resultado OS: botão QR
function gerarQRTesteResultado(res, cliente, aparelho, numOS, osId) {
  // Usa osId direto se disponível, senão busca pelo numOS
  const historico = getHistorico()
  const osReal = (osId && historico.find(o => o.id === osId))
              || historico.find(o => o.numOS == numOS)
              || null
  const osTemp = osReal || { id:'', numOS, cliente, aparelho, servicos: res.servicos||[], servico: res.servicos?.[0]?.nome||'' }
  gerarQRTeste(osTemp)
}

// ===== VER LAUDO NA OS =====
function verLaudo(osId) {
  const os = getHistorico().find(o => o.id === osId)
  if (!os?.laudoTecnico) return
  const l = os.laudoTecnico
  const iconRes = { ok:'✅', fail:'❌', skip:'⏭️' }
  const labelRes = { ok:'Aprovado', fail:'Com defeito', skip:'Não testado' }
  const badgeStyle = { ok:'color:var(--green)', fail:'color:var(--red)', skip:'color:var(--text3)' }
  const testeNomes = {
    touch:'👆 Touch', display:'🖥️ Display', camera:'📷 Câmera',
    microfone:'🎙️ Microfone', alto_falante:'🔊 Alto-falante', vibracao:'📳 Vibração',
    acelerometro:'📐 Acelerômetro', luz:'💡 Sensor Luz', bateria:'🔋 Bateria', conectividade:'📶 Conectividade'
  }
  const itens = Object.entries(l.resultados||{}).map(([k,v]) =>
    `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px">
      <span style="color:var(--text2)">${testeNomes[k]||k}</span>
      <span style="${badgeStyle[v]||''};font-weight:600">${iconRes[v]||'⏭️'} ${labelRes[v]||''}</span>
    </div>`
  ).join('')

  // usa modal de pdf que já existe, adaptando o conteúdo
  document.getElementById('pdf-preview-content').innerHTML = `
    <div style="padding:16px;background:var(--bg2)">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:36px">${l.aprovado?'✅':'❌'}</div>
        <div style="font-size:17px;font-weight:700;margin-top:4px">${l.aprovado?'Aprovado':'Com defeitos'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${l.data||''}</div>
      </div>
      ${itens}
    </div>`
  document.querySelector('#modal-pdf-overlay .modal-title').textContent = '📋 Laudo Técnico'
  document.querySelector('#modal-pdf-overlay .btn-primary').textContent = '📱 Copiar laudo'
  document.querySelector('#modal-pdf-overlay .btn-primary').onclick = () => {
    navigator.clipboard.writeText(l.texto||'').then(() => { showToast('📋 Laudo copiado!'); fecharModalPdf() }).catch(()=>{})
  }
  document.getElementById('modal-pdf-overlay').classList.add('open')
}

// ===== VERIFICAR ATUALIZAÇÃO =====
async function verificarAtualizacao() {
  const btn = document.getElementById('btn-update')
  const status = document.getElementById('update-status')
  if (btn) { btn.textContent = '⏳ Verificando...'; btn.disabled = true }
  if (status) status.textContent = ''

  try {
    // 1) Força o SW a checar nova versão
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.update()
        // Se tem SW esperando, ativa imediatamente
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          if (status) status.textContent = '✅ Atualização encontrada! Recarregando...'
          setTimeout(() => window.location.reload(true), 1500)
          return
        }
      }
    }

    // 2) Limpa todos os caches manualmente
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }

    if (status) status.textContent = '✅ Cache limpo! Recarregando com versão mais recente...'
    setTimeout(() => window.location.reload(true), 1500)

  } catch(e) {
    // Fallback: força reload ignorando cache
    if (status) status.textContent = 'Recarregando...'
    setTimeout(() => window.location.reload(true), 800)
  }
}
