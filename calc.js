// ===== CALC v5 =====

let _fotoBase64 = null
let _servicosItems = []
let _servicoId = 0

// ===== MÚLTIPLOS SERVIÇOS =====
function initServicos() {
  _servicosItems = []
  _servicoId = 0
  document.getElementById('servicos-lista').innerHTML = ''
  adicionarServico()
}

function adicionarServico(nome='', valorPeca=0, minutos=0) {
  const id = ++_servicoId
  _servicosItems.push(id)
  const precos = getPrecos()
  const opcoesPrecos = precos.length > 0
    ? `<button class="btn-preco-rapido" onclick="abrirSeletorPreco(${id})">📋 Da tabela</button>`
    : ''

  const html = `
  <div class="servico-item" id="servico-item-${id}">
    <div class="servico-item-header">
      <span class="servico-num">Serviço ${_servicosItems.indexOf(id)+1}</span>
      ${_servicosItems.length > 1 ? `<button class="btn-remove-servico" onclick="removerServico(${id})">✕</button>` : ''}
    </div>
    <div class="input-group">
      <label class="input-label">Nome do serviço *</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="srv-nome-${id}" class="input-field" placeholder="Ex: Troca de tela" value="${esc(nome)}" oninput="previewCalc()" style="flex:1">
        ${opcoesPrecos}
      </div>
    </div>
    <div class="input-row">
      <div class="input-group"><label class="input-label">Valor da Peça (R$)</label><input id="srv-peca-${id}" class="input-field" type="number" placeholder="0,00" min="0" step="0.01" value="${valorPeca||''}" oninput="previewCalc()"></div>
      <div class="input-group"><label class="input-label">Tempo (min)</label><input id="srv-min-${id}" class="input-field" type="number" placeholder="0" min="0" value="${minutos||''}" oninput="previewCalc()"></div>
    </div>
  </div>`
  document.getElementById('servicos-lista').insertAdjacentHTML('beforeend', html)
  previewCalc()
}

function removerServico(id) {
  _servicosItems = _servicosItems.filter(i => i !== id)
  document.getElementById(`servico-item-${id}`)?.remove()
  // renumerar labels
  document.querySelectorAll('.servico-num').forEach((el, i) => el.textContent = `Serviço ${i+1}`)
  // mostrar/esconder botão remover
  document.querySelectorAll('.btn-remove-servico').forEach(btn => {
    btn.style.display = _servicosItems.length > 1 ? 'block' : 'none'
  })
  previewCalc()
}

function abrirSeletorPreco(id) {
  const precos = getPrecos()
  if (!precos.length) return
  const opcoes = precos.map(p => `<button class="btn-preco-opcao" onclick="aplicarPreco(${id},'${esc(p.nome)}',${p.peca},${p.minutos})">${esc(p.nome)} — ${fmt(p.peca)} · ${p.minutos}min</button>`).join('')
  const d = document.createElement('div')
  d.id = 'seletor-preco-overlay'
  d.className = 'modal-overlay open'
  d.innerHTML = `<div class="modal modal-edit" onclick="event.stopPropagation()"><h3 class="modal-title">📋 Selecionar serviço</h3><div class="precos-opcoes">${opcoes}</div><button class="btn-secondary" style="width:100%;margin-top:12px" onclick="document.getElementById('seletor-preco-overlay').remove()">Cancelar</button></div>`
  document.body.appendChild(d)
}

function aplicarPreco(id, nome, peca, minutos) {
  document.getElementById(`srv-nome-${id}`).value = nome
  document.getElementById(`srv-peca-${id}`).value = peca
  document.getElementById(`srv-min-${id}`).value = minutos
  document.getElementById('seletor-preco-overlay')?.remove()
  previewCalc()
}

function getServicosDoForm() {
  return _servicosItems.map(id => ({
    nome: document.getElementById(`srv-nome-${id}`)?.value?.trim() || '',
    valorPeca: Number(document.getElementById(`srv-peca-${id}`)?.value) || 0,
    minutos: Number(document.getElementById(`srv-min-${id}`)?.value) || 0
  })).filter(s => s.nome)
}

// ===== CÁLCULO CORE =====
function calcular(params) {
  const config = getConfig()
  const { servicos=[], transporte=0, desconto=0, pagamento='dinheiro' } = params

  let totalValorPeca = 0, totalMaoDeObra = 0, totalMargemGarantia = 0, totalPecaFinal = 0

  servicos.forEach(s => {
    const mdo = (config.valorHora / 60) * s.minutos
    const mg = s.valorPeca * (config.minimoPeca / 100)
    const pf = s.valorPeca + mg
    totalValorPeca += s.valorPeca
    totalMaoDeObra += mdo
    totalMargemGarantia += mg
    totalPecaFinal += pf
  })

  const rateioFixo = config.metaOS > 0 ? config.custoFixo / config.metaOS : 0
  const custoBase = totalPecaFinal + totalMaoDeObra + config.insumos + transporte + rateioFixo
  let subtotal = custoBase * (1 + config.margem / 100)

  let taxa = 0
  if (pagamento === 'cartao') taxa = subtotal * (config.taxaCartao / 100)
  else if (pagamento === 'debito') taxa = subtotal * (config.taxaDebito / 100)

  let valorFinal = subtotal + taxa - desconto
  const comissao = valorFinal * (config.comissao / 100)
  const fundo = valorFinal * (config.fundo / 100)
  const lucroReal = valorFinal - totalValorPeca - totalMaoDeObra - config.insumos - transporte - rateioFixo - comissao - fundo - taxa

  return {
    valorFinal: Math.max(0, valorFinal), lucroReal,
    totalMaoDeObra, totalPecaFinal, totalValorPeca, totalMargemGarantia,
    minimoPeca: config.minimoPeca, rateioFixo, taxa, comissao, fundo,
    insumos: config.insumos, transporte, desconto, pagamento, servicos
  }
}

// ===== FOTO =====
function carregarFoto(input) {
  const file = input.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX = 800; let w = img.width, h = img.height
      if (w > MAX) { h = h*MAX/w; w = MAX }
      if (h > MAX) { w = w*MAX/h; h = MAX }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      _fotoBase64 = canvas.toDataURL('image/jpeg', 0.75)
      document.getElementById('foto-preview').src = _fotoBase64
      document.getElementById('foto-preview').style.display = 'block'
      document.getElementById('foto-placeholder').style.display = 'none'
      document.getElementById('foto-remove-btn').style.display = 'block'
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}

function removerFoto(e) {
  if (e) e.stopPropagation()
  _fotoBase64 = null
  document.getElementById('foto-preview').style.display = 'none'
  document.getElementById('foto-preview').src = ''
  document.getElementById('foto-placeholder').style.display = 'flex'
  document.getElementById('foto-remove-btn').style.display = 'none'
  document.getElementById('foto-input').value = ''
}

// ===== CALCULAR E SALVAR OS =====
function calcularOS() {
  const cliente = document.getElementById('cliente').value.trim()
  const aparelho = document.getElementById('aparelho').value.trim()
  const whatsapp = document.getElementById('whatsapp').value.trim()
  const obs = document.getElementById('obs').value.trim()
  const servicos = getServicosDoForm()

  if (!cliente || !aparelho) { showToast('⚠️ Preencha cliente e aparelho'); return }
  if (servicos.length === 0) { showToast('⚠️ Adicione ao menos um serviço'); return }

  const params = {
    servicos,
    transporte: Number(document.getElementById('transporte').value) || 0,
    desconto: Number(document.getElementById('desconto').value) || 0,
    pagamento: document.getElementById('pagamento').value
  }

  const res = calcular(params)
  const { numOS, osId } = salvarOS({ cliente, aparelho, whatsapp, obs, servicos, valorFinal: res.valorFinal,
    lucroReal: res.lucroReal, comissao: res.comissao, fundo: res.fundo,
    pagamento: res.pagamento, detalhes: res, foto: _fotoBase64 })

  mostrarResultado(res, { cliente, aparelho, whatsapp, obs, numOS, osId })

  document.getElementById('cliente').value = ''
  document.getElementById('aparelho').value = ''
  document.getElementById('whatsapp').value = ''
  document.getElementById('obs').value = ''
  document.getElementById('transporte').value = ''
  document.getElementById('desconto').value = ''
  document.getElementById('pagamento').value = 'dinheiro'
  document.getElementById('preview-box').style.display = 'none'
  removerFoto()
  initServicos()
  showToast(`✅ OS #${String(numOS).padStart(3,'0')} salva!`)
}

function previewCalc() {
  const servicos = getServicosDoForm()
  const params = {
    servicos,
    transporte: Number(document.getElementById('transporte')?.value) || 0,
    desconto: Number(document.getElementById('desconto')?.value) || 0,
    pagamento: document.getElementById('pagamento')?.value || 'dinheiro'
  }
  if (servicos.length === 0) { document.getElementById('preview-box').style.display = 'none'; return }
  const res = calcular(params)
  document.getElementById('preview-box').style.display = 'block'
  document.getElementById('prev-valor').textContent = fmt(res.valorFinal)
  document.getElementById('prev-lucro').textContent = fmt(res.lucroReal)
  document.getElementById('prev-lucro').style.color = res.lucroReal >= 0 ? 'var(--green)' : 'var(--red)'
}

// ===== ORÇAMENTO =====
function previewOrc() {
  const params = {
    servicos: [{ nome: 'Serviço', valorPeca: Number(document.getElementById('orc-valorPeca').value)||0, minutos: Number(document.getElementById('orc-minutos').value)||0 }],
    transporte: Number(document.getElementById('orc-transporte').value)||0,
    desconto: Number(document.getElementById('orc-desconto').value)||0,
    pagamento: document.getElementById('orc-pagamento').value
  }
  if (!params.servicos[0].valorPeca && !params.servicos[0].minutos) { document.getElementById('orc-preview-box').style.display = 'none'; return }
  const res = calcular(params)
  document.getElementById('orc-preview-box').style.display = 'block'
  document.getElementById('orc-prev-valor').textContent = fmt(res.valorFinal)
  document.getElementById('orc-prev-lucro').textContent = fmt(res.lucroReal)
}

function salvarOrcamento() {
  const cliente = document.getElementById('orc-cliente').value.trim()
  const aparelho = document.getElementById('orc-aparelho').value.trim()
  const servico = document.getElementById('orc-servico').value.trim()
  const whatsapp = document.getElementById('orc-whatsapp').value.trim()
  if (!cliente || !aparelho || !servico) { showToast('⚠️ Preencha cliente, aparelho e serviço'); return }
  const params = {
    servicos: [{ nome: servico, valorPeca: Number(document.getElementById('orc-valorPeca').value)||0, minutos: Number(document.getElementById('orc-minutos').value)||0 }],
    transporte: Number(document.getElementById('orc-transporte').value)||0,
    desconto: Number(document.getElementById('orc-desconto').value)||0,
    pagamento: document.getElementById('orc-pagamento').value
  }
  const validade = Number(document.getElementById('orc-validade').value)||7
  const res = calcular(params)
  salvarOrcamentoData({ cliente, aparelho, servico, whatsapp, valorFinal: res.valorFinal, lucroReal: res.lucroReal, comissao: res.comissao, fundo: res.fundo, pagamento: res.pagamento, detalhes: res, validade })
  ;['orc-cliente','orc-aparelho','orc-servico','orc-whatsapp','orc-valorPeca','orc-minutos','orc-transporte','orc-desconto'].forEach(id => { const el = document.getElementById(id); if(el) el.value='' })
  document.getElementById('orc-validade').value = 7
  document.getElementById('orc-preview-box').style.display = 'none'
  showToast('✅ Orçamento salvo!')
  atualizarListaOrcamentos()
}

// ===== RESULTADO =====
function mostrarResultado(res, info) {
  const pagtLabel = { dinheiro:'Dinheiro/Pix', cartao:'Cartão Crédito', debito:'Cartão Débito' }[res.pagamento]||''
  const numStr = info.numOS ? `OS #${String(info.numOS).padStart(3,'0')}` : ''
  const servicosHTML = (res.servicos||[]).map(s => {
    const mdo = (getConfig().valorHora/60)*s.minutos
    const mg = s.valorPeca*(getConfig().minimoPeca/100)
    return `<div class="res-item"><span class="res-name">🔧 ${esc(s.nome)}</span><span class="res-amount">${fmt(s.valorPeca + mg + mdo)}</span></div>`
  }).join('')

  const html = `
    <div class="resultado-header">
      <div class="res-os-num">${numStr}</div>
      <div class="res-label">Valor a cobrar do cliente</div>
      <div class="res-valor">${fmt(res.valorFinal)}</div>
      <div class="res-lucro">Lucro líquido: ${fmt(res.lucroReal)}</div>
    </div>
    <div class="resultado-body">
      ${servicosHTML}
      ${res.totalMargemGarantia > 0 ? `<div class="res-item"><span class="res-name">🛡️ Reserva garantia (${res.minimoPeca}%)</span><span class="res-amount">${fmt(res.totalMargemGarantia)}</span></div>` : ''}
      <div class="res-item"><span class="res-name">⏱️ Mão de obra total</span><span class="res-amount">${fmt(res.totalMaoDeObra)}</span></div>
      <div class="res-item"><span class="res-name">🧴 Insumos</span><span class="res-amount">${fmt(res.insumos)}</span></div>
      ${res.transporte > 0 ? `<div class="res-item"><span class="res-name">🚗 Transporte</span><span class="res-amount">${fmt(res.transporte)}</span></div>` : ''}
      <div class="res-item"><span class="res-name">🏢 Rateio fixo</span><span class="res-amount">${fmt(res.rateioFixo)}</span></div>
      ${res.taxa > 0 ? `<div class="res-item"><span class="res-name">💳 Taxa ${pagtLabel}</span><span class="res-amount">${fmt(res.taxa)}</span></div>` : ''}
      ${res.comissao > 0 ? `<div class="res-item"><span class="res-name">🤝 Comissão</span><span class="res-amount">${fmt(res.comissao)}</span></div>` : ''}
      ${res.fundo > 0 ? `<div class="res-item"><span class="res-name">🏦 Fundo garantia</span><span class="res-amount">${fmt(res.fundo)}</span></div>` : ''}
      ${res.desconto > 0 ? `<div class="res-item"><span class="res-name">🏷️ Desconto</span><span class="res-amount">-${fmt(res.desconto)}</span></div>` : ''}
      <div class="res-item total"><span class="res-name">Total cobrado</span><span class="res-amount">${fmt(res.valorFinal)}</span></div>
      <div class="res-item profit"><span class="res-name">✅ Lucro real</span><span class="res-amount">${fmt(res.lucroReal)}</span></div>
    </div>
    <div class="res-actions">
      <button class="btn-share btn-wpp" onclick='compartilharWpp(${JSON.stringify(res)},"${esc(info.cliente)}","${esc(info.aparelho)}",${info.numOS||0})'>📱 WhatsApp</button>
      <button class="btn-share btn-pdf" onclick='gerarPdf(${JSON.stringify(res)},"${esc(info.cliente)}","${esc(info.aparelho)}","${esc(info.whatsapp||'')}","${esc(info.obs||'')}",${info.numOS||0})'>📄 Comprovante</button>
    <button class="btn-share btn-qr" onclick='gerarQRTesteResultado(${JSON.stringify(res)},"${esc(info.cliente)}","${esc(info.aparelho)}",${info.numOS||0},"${info.osId||''}")'>📱 QR Teste</button>
    </div>`
  const el = document.getElementById('resultado')
  el.innerHTML = html; el.style.display = 'block'
  el.scrollIntoView({ behavior:'smooth', block:'start' })
}

// ===== TABELA DE PREÇOS =====
function adicionarPreco() {
  const nome = document.getElementById('preco-nome').value.trim()
  const peca = Number(document.getElementById('preco-peca').value)||0
  const minutos = Number(document.getElementById('preco-minutos').value)||0
  if (!nome) { showToast('⚠️ Digite o nome do serviço'); return }
  salvarPreco({ nome, peca, minutos })
  document.getElementById('preco-nome').value = ''
  document.getElementById('preco-peca').value = ''
  document.getElementById('preco-minutos').value = ''
  showToast('✅ Serviço adicionado!')
  atualizarListaPrecos()
}

function atualizarListaPrecos() {
  const precos = getPrecos()
  const el = document.getElementById('lista-precos')
  if (!el) return
  if (precos.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏷️</div><div class="empty-title">Nenhum serviço cadastrado</div><div class="empty-desc">Adicione serviços para usar na Nova OS</div></div>`
    return
  }
  el.innerHTML = precos.map(p => `
    <div class="preco-card">
      <div class="preco-info">
        <div class="preco-nome">${esc(p.nome)}</div>
        <div class="preco-detalhes">Peça: ${fmt(p.peca)} · ${p.minutos} min</div>
      </div>
      <button class="btn-action delete" onclick="excluirPreco('${p.id}');atualizarListaPrecos()">🗑️</button>
    </div>`).join('')
}

// ===== PDF / COMPROVANTE =====
let _pdfData = null

function gerarPdf(res, cliente, aparelho, whatsapp, obs, numOS, laudo) {
  const config = getConfig()
  const data = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  const numStr = numOS ? `OS #${String(numOS).padStart(3,'0')}` : 'OS'
  const pagtLabel = { dinheiro:'Dinheiro / Pix', cartao:'Cartão de Crédito', debito:'Cartão de Débito' }[res.pagamento]||''
  const servicosLinhas = (res.servicos||[]).map(s => `<tr><td>${esc(s.nome)}</td><td style="text-align:right">${fmt(s.valorPeca)}</td><td style="text-align:right">${s.minutos}min</td></tr>`).join('')

  _pdfData = `
  <!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;max-width:400px;margin:0 auto;padding:20px}
    .header{text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px}
    .logo-nome{font-size:20px;font-weight:700;color:#1e3a5f}
    .os-num{font-size:24px;font-weight:700;color:#1e3a5f;margin:4px 0}
    .data{font-size:11px;color:#666}
    .section{margin:12px 0}
    .section-title{font-weight:700;font-size:11px;text-transform:uppercase;color:#666;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px}
    .row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
    .row.total{font-weight:700;font-size:15px;border-top:2px solid #111;margin-top:6px;padding-top:6px}
    .row.lucro{color:green;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:12px}
    table th{background:#f0f4f8;text-align:left;padding:5px 4px;font-size:11px}
    table td{padding:5px 4px;border-bottom:1px solid #f0f0f0}
    .obs-box{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:8px;font-size:12px;color:#444;margin-top:6px}
    .footer{text-align:center;margin-top:20px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px}
    @media print{body{max-width:100%}}
  </style></head><body>
  <div class="header">
    ${config.nomeLoja ? `<div class="logo-nome">${esc(config.nomeLoja)}</div>` : '<div class="logo-nome">LucroTech PRO</div>'}
    ${config.whatsappLoja ? `<div class="data">WhatsApp: ${config.whatsappLoja}</div>` : ''}
    <div class="os-num">${numStr}</div>
    <div class="data">${data}</div>
  </div>

  <div class="section">
    <div class="section-title">Cliente</div>
    <div class="row"><span>Nome</span><span><strong>${esc(cliente)}</strong></span></div>
    <div class="row"><span>Aparelho</span><span>${esc(aparelho)}</span></div>
    ${whatsapp ? `<div class="row"><span>WhatsApp</span><span>${whatsapp}</span></div>` : ''}
    <div class="row"><span>Pagamento</span><span>${pagtLabel}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Serviços</div>
    <table><thead><tr><th>Serviço</th><th>Peça</th><th>Tempo</th></tr></thead><tbody>${servicosLinhas}</tbody></table>
  </div>

  ${obs ? `<div class="section"><div class="section-title">Observações</div><div class="obs-box">${esc(obs)}</div></div>` : ''}

  <div class="section">
    <div class="section-title">Resumo Financeiro</div>
    ${res.transporte > 0 ? `<div class="row"><span>Transporte</span><span>${fmt(res.transporte)}</span></div>` : ''}
    ${res.taxa > 0 ? `<div class="row"><span>Taxa ${pagtLabel}</span><span>${fmt(res.taxa)}</span></div>` : ''}
    ${res.desconto > 0 ? `<div class="row"><span>Desconto</span><span>-${fmt(res.desconto)}</span></div>` : ''}
    <div class="row total"><span>TOTAL</span><span>${fmt(res.valorFinal)}</span></div>
  </div>

  ${laudo ? `
  <div class="section">
    <div class="section-title" style="color:${laudo.aprovado?'#16a34a':'#dc2626'}">
      🔬 Laudo Técnico — ${laudo.aprovado ? '✅ APROVADO' : '❌ COM DEFEITOS'}
    </div>
    <table>
      <thead><tr><th>Componente</th><th style="text-align:right">Resultado</th></tr></thead>
      <tbody>
        ${Object.entries(laudo.resultados||{}).map(([k,v]) => {
          const nomes = {touch:'Touch',display:'Display',camera:'Câmera',microfone:'Microfone',alto_falante:'Alto-falante',vibracao:'Vibração',acelerometro:'Acelerômetro',luz:'Sensor Luz',bateria:'Bateria',conectividade:'Conectividade'}
          const icons = {ok:'✅ OK',fail:'❌ Defeito',skip:'— N/T'}
          return `<tr><td>${nomes[k]||k}</td><td style="text-align:right;font-weight:600;color:${v==='ok'?'#16a34a':v==='fail'?'#dc2626':'#666'}">${icons[v]||v}</td></tr>`
        }).join('')}
      </tbody>
    </table>
    <div style="font-size:10px;color:#999;margin-top:6px">Laudo gerado em ${laudo.data||''}</div>
  </div>` : ''}

  <div class="footer">Gerado por LucroTech PRO · Obrigado pela preferência!</div>
  </body></html>`

  document.getElementById('pdf-preview-content').innerHTML = _pdfData
  document.getElementById('modal-pdf-overlay').classList.add('open')
}

function fecharModalPdf() { document.getElementById('modal-pdf-overlay').classList.remove('open') }

function imprimirPdf() {
  if (!_pdfData) return
  const w = window.open('', '_blank')
  w.document.write(_pdfData)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 500)
}

// ===== COMPARTILHAR =====
function textoOS(res, cliente, aparelho, numOS) {
  const config = getConfig()
  const pagtLabel = { dinheiro:'Dinheiro/Pix', cartao:'Cartão Crédito', debito:'Cartão Débito' }[res.pagamento]||''
  const numStr = numOS ? `OS #${String(numOS).padStart(3,'0')}` : 'OS'
  const servicosLinhas = (res.servicos||[]).map(s => `🔧 ${s.nome}`).join('\n')
  const loja = config.nomeLoja ? `*${config.nomeLoja}*\n` : ''
  return `${loja}📋 *${numStr}*\n\n👤 Cliente: ${cliente}\n📱 Aparelho: ${aparelho}\n\n${servicosLinhas}\n\n💳 Pagamento: ${pagtLabel}${res.desconto > 0 ? `\n🏷️ Desconto: -${fmt(res.desconto)}`:''}${res.transporte > 0 ? `\n🚗 Transporte: ${fmt(res.transporte)}`:''}${res.taxa > 0 ? `\n💳 Taxa: ${fmt(res.taxa)}`:''}\n\n✅ *Total: ${fmt(res.valorFinal)}*`
}

function textoOrcamento(orc) {
  const venc = new Date(orc.data); venc.setDate(venc.getDate() + orc.validade)
  const config = getConfig()
  const loja = config.nomeLoja ? `*${config.nomeLoja}*\n` : ''
  return `${loja}📋 *Orçamento*\n\n👤 ${orc.cliente}\n📱 ${orc.aparelho}\n🛠️ ${orc.servico}\n\n✅ *Valor: ${fmt(orc.valorFinal)}*\n\n⏰ Válido até: ${venc.toLocaleDateString('pt-BR')}`
}

function compartilharWpp(res, cliente, aparelho, numOS) {
  window.open(`https://wa.me/?text=${encodeURIComponent(textoOS(res,cliente,aparelho,numOS))}`, '_blank')
}

function compartilharOrcWpp(id) {
  const orc = getOrcamentos().find(o => o.id === id)
  if (!orc) return
  const num = orc.whatsapp ? `https://wa.me/55${orc.whatsapp.replace(/\D/g,'')}?text=` : 'https://wa.me/?text='
  window.open(`${num}${encodeURIComponent(textoOrcamento(orc))}`, '_blank')
}

function compartilharOSWpp(id) {
  const os = getHistorico().find(o => o.id === id)
  if (!os) return
  const res = os.detalhes || { valorFinal:os.valorFinal, lucroReal:os.lucroReal, servicos:[], totalValorPeca:0, totalMaoDeObra:0, transporte:0, desconto:0, insumos:0, margemGarantia:0, pagamento:os.pagamento||'dinheiro' }
  const num = os.whatsapp ? `https://wa.me/55${os.whatsapp.replace(/\D/g,'')}?text=` : 'https://wa.me/?text='
  window.open(`${num}${encodeURIComponent(textoOS(res, os.cliente, os.aparelho, os.numOS))}`, '_blank')
}

function gerarPdfOS(id) {
  const os = getHistorico().find(o => o.id === id)
  if (!os) return
  const res = os.detalhes || { valorFinal:os.valorFinal, servicos:[], transporte:0, desconto:0, taxa:0, pagamento:'dinheiro' }
  gerarPdf(res, os.cliente, os.aparelho, os.whatsapp||'', os.obs||'', os.numOS, os.laudoTecnico||null)
}

function fmt(v) {
  return 'R$ ' + Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
