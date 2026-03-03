// ===== STORAGE v5 =====

function getConfig() {
  return JSON.parse(localStorage.getItem('lt_config')) || {
    nomeLoja:'', whatsappLoja:'',
    valorHora:0, margem:0, taxaCartao:0, taxaDebito:0,
    comissao:0, fundo:0, custoFixo:0, metaOS:1, minimoPeca:0, insumos:0
  }
}

function salvarConfig() {
  const fields = ['valorHora','margem','taxaCartao','taxaDebito','comissao','fundo','custoFixo','metaOS','minimoPeca','insumos']
  const config = { nomeLoja: v('nomeLoja'), whatsappLoja: v('whatsappLoja') }
  fields.forEach(f => config[f] = Number(document.getElementById(f)?.value) || 0)
  if (!config.metaOS) config.metaOS = 1
  localStorage.setItem('lt_config', JSON.stringify(config))
  showToast('✅ Configurações salvas!')
}

function carregarConfigNaTela() {
  const c = getConfig()
  const fields = ['nomeLoja','whatsappLoja','valorHora','margem','taxaCartao','taxaDebito','comissao','fundo','custoFixo','metaOS','minimoPeca','insumos']
  fields.forEach(f => { const el = document.getElementById(f); if (el && c[f]) el.value = c[f] })
}

function v(id) { return document.getElementById(id)?.value?.trim() || '' }

// ===== HISTÓRICO =====
function getHistorico() { return JSON.parse(localStorage.getItem('lt_historico')) || [] }

function getProximoNumOS() {
  const h = getHistorico()
  const nums = h.map(o => o.numOS || 0).filter(n => n > 0)
  return nums.length > 0 ? Math.max(...nums) + 1 : 1
}

function salvarOS(os) {
  const h = getHistorico()
  os.id = Date.now().toString()
  os.data = new Date().toISOString()
  os.status = os.status || 'andamento'
  os.numOS = getProximoNumOS()
  h.unshift(os)
  localStorage.setItem('lt_historico', JSON.stringify(h))
  return { numOS: os.numOS, osId: os.id }
}

function excluirOS(id) {
  localStorage.setItem('lt_historico', JSON.stringify(getHistorico().filter(o => o.id !== id)))
}

function editarOS(id, campos) {
  const h = getHistorico()
  const i = h.findIndex(o => o.id === id)
  if (i !== -1) { h[i] = { ...h[i], ...campos }; localStorage.setItem('lt_historico', JSON.stringify(h)) }
}

// ===== ORÇAMENTOS =====
function getOrcamentos() { return JSON.parse(localStorage.getItem('lt_orcamentos')) || [] }

function salvarOrcamentoData(orc) {
  const list = getOrcamentos()
  orc.id = Date.now().toString()
  orc.data = new Date().toISOString()
  orc.statusOrc = 'pendente'
  list.unshift(orc)
  localStorage.setItem('lt_orcamentos', JSON.stringify(list))
}

function excluirOrcamento(id) {
  localStorage.setItem('lt_orcamentos', JSON.stringify(getOrcamentos().filter(o => o.id !== id)))
}

function orcamentoVirarOS(id) {
  const orcs = getOrcamentos()
  const orc = orcs.find(o => o.id === id)
  if (!orc) return
  const i = orcs.findIndex(o => o.id === id)
  orcs[i].statusOrc = 'aprovado'
  localStorage.setItem('lt_orcamentos', JSON.stringify(orcs))
  const numOS = salvarOS({
    cliente: orc.cliente, aparelho: orc.aparelho,
    servicos: orc.servicos || [{ nome: orc.servico, valorPeca: 0, minutos: 0 }],
    servico: orc.servico,
    whatsapp: orc.whatsapp || '',
    valorFinal: orc.valorFinal, lucroReal: orc.lucroReal,
    comissao: orc.comissao, fundo: orc.fundo,
    pagamento: orc.pagamento, detalhes: orc.detalhes, status: 'andamento'
  })
  showToast(`✅ OS #${String(numOS).padStart(3,'0')} criada!`)
  abrirTela('historico')
}

// ===== TABELA DE PREÇOS =====
function getPrecos() { return JSON.parse(localStorage.getItem('lt_precos')) || [] }

function salvarPreco(preco) {
  const list = getPrecos()
  preco.id = Date.now().toString()
  list.push(preco)
  localStorage.setItem('lt_precos', JSON.stringify(list))
}

function excluirPreco(id) {
  localStorage.setItem('lt_precos', JSON.stringify(getPrecos().filter(p => p.id !== id)))
}

// ===== BACKUP =====
function exportarDados() {
  const dados = {
    versao: '5.0', exportado: new Date().toISOString(),
    config: getConfig(), historico: getHistorico(),
    orcamentos: getOrcamentos(), precos: getPrecos()
  }
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lucrotech-backup-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast('✅ Backup exportado!')
}

function importarDados(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result)
      if (!dados.historico && !dados.config) throw new Error('inválido')
      if (!confirm(`Importar backup de ${new Date(dados.exportado).toLocaleDateString('pt-BR')}?\n${dados.historico?.length||0} OS. Vai substituir dados atuais.`)) return
      if (dados.config) localStorage.setItem('lt_config', JSON.stringify(dados.config))
      if (dados.historico) localStorage.setItem('lt_historico', JSON.stringify(dados.historico))
      if (dados.orcamentos) localStorage.setItem('lt_orcamentos', JSON.stringify(dados.orcamentos))
      if (dados.precos) localStorage.setItem('lt_precos', JSON.stringify(dados.precos))
      showToast('✅ Backup importado!')
      abrirTela('dashboard')
    } catch(err) { showToast('❌ Arquivo inválido') }
  }
  reader.readAsText(file)
  input.value = ''
}

function limparTodosDados() {
  if (!confirm('Tem certeza? Todos os dados serão apagados permanentemente.')) return
  ['lt_historico','lt_config','lt_orcamentos','lt_precos'].forEach(k => localStorage.removeItem(k))
  showToast('🗑️ Dados apagados')
  abrirTela('dashboard')
}
