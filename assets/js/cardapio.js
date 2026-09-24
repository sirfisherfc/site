/* ===========================================================================
   Sir Fisher | Portal do cardapio
   ---------------------------------------------------------------------------
   O que este arquivo faz, e o que ele deliberadamente NAO faz.

   FAZ
   - Desenha o catalogo inteiro em rolagem vertical comum. Nome, preco, porcao
     confirmada e descricao curta ficam na propria lista: abrir um produto
     nunca e necessario para descobrir quanto custa ou quanto vem.
   - Atalhos com nomes escritos e busca opcional. Nenhum produto depende de
     carrossel, gesto lateral, icone sem texto ou filtro para ser alcancado.
   - Detalhe com endereco proprio, para o botao Voltar do navegador funcionar
     e a lista voltar na mesma posicao.
   - Le primeiro a copia estatica (pintura imediata) e depois confere a
     publicacao ao vivo. Conteudo novo nao empurra a leitura de quem esta no
     meio da pagina: aparece um aviso discreto para trocar quando quiser.

   NAO FAZ
   - Carrinho, selecao pessoal, contador, subtotal, favoritos, botao de
     finalizar ou tela para mostrar ao garcom. O cliente le, decide e pede
     falando. A consulta pode terminar em qualquer produto, sem clique nenhum.
   - Nao afirma compatibilidade alimentar. As marcacoes vem do cardapio
     impresso, ainda sem conferencia da cozinha, e vao sempre com essa ressalva.
   - Nao manda texto de busca nem preferencia alimentar para analytics.
   =========================================================================== */

(function () {
  'use strict';

  var CAMINHO_ESTATICO = './dados/cardapio.json';
  var SUPABASE_URL = 'https://lucpxoynpvogkvzepagi.supabase.co';
  // Chave anonima, de leitura, a mesma ja publicada no painel. Ela so alcanca
  // a view cardapio_publico, que por construcao devolve unicamente a
  // publicacao ativa. Nenhuma chave privilegiada vem para o navegador.
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y3B4b3lucHZvZ2t2emVwYWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDYxNzQsImV4cCI6MjA5OTE4MjE3NH0.r0XGYX1KqAXQA4g9uoUAFLFTEaWUEXobWqyKVe0_SnE';
  var DIAS_COPIA_VELHA = 7;

  // Origem autorizada a mandar uma previa para esta pagina. E o painel de
  // gestao, que embute o portal num iframe para o operador ver o rascunho
  // exatamente como o cliente vera. So renderiza: a previa nunca escreve nada.
  var ORIGEM_PREVIA = 'https://admin.sirfisher.com.br';

  var estado = {
    dados: null,
    pendente: null,        // publicacao mais nova, esperando o cliente aceitar
    rolagemGuardada: 0,
    origemCopia: 'estatica',
    carregadoEm: null
  };

  // -------------------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------------------

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }

  function esc(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function semAcento(texto) {
    return String(texto || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function dinheiro(centavos) {
    if (centavos === null || centavos === undefined) return '';
    return 'R$ ' + (centavos / 100).toFixed(2).replace('.', ',');
  }

  function dataCurta(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Eventos de consulta. Sao sinais de leitura, nunca confirmacao de escolha
  // ou de venda: o cliente pode ler o item na lista e pedir ao garcom sem
  // tocar em nada. Nenhum texto digitado e nenhuma preferencia alimentar sai
  // daqui — so contagens.
  function sinal(nome, carga) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: nome }, carga || {}));
      if (typeof window.gtag === 'function') window.gtag('event', nome, carga || {});
    } catch (e) { /* medicao nunca pode quebrar a leitura */ }
  }

  // -------------------------------------------------------------------------
  // Informacao alimentar
  // -------------------------------------------------------------------------

  // Os dez rotulos do cardapio impresso, preservados como estao na fonte.
  // LACTOSE e LEITE sao rotulos distintos no documento e continuam distintos
  // aqui: nao foram fundidos numa taxonomia regulatoria.
  var GLIFOS = {
    'GLÚTEN': '<path d="M12 3v18M12 7c-2-2-4-2-5-1 1 2 3 3 5 3zm0 0c2-2 4-2 5-1-1 2-3 3-5 3zm0 5c-2-2-4-2-5-1 1 2 3 3 5 3zm0 0c2-2 4-2 5-1-1 2-3 3-5 3zm0 5c-2-2-4-2-5-1 1 2 3 3 5 3zm0 0c2-2 4-2 5-1-1 2-3 3-5 3z"/>',
    'LACTOSE': '<path d="M9 2h6v3l2 3v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-3z"/><path d="M7 12h10"/>',
    'LEITE': '<path d="M4 17c0-4 2-6 4-7V5h8v5c2 1 4 3 4 7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M8 5h8"/>',
    'OVO': '<ellipse cx="12" cy="13.5" rx="6" ry="8"/><path d="M12 5.5c1.5 1.5 2.5 3 3 4.5"/>',
    'PEIXE': '<path d="M3 12c3-4 7-5 10-5s6 2 8 5c-2 3-5 5-8 5s-7-1-10-5z"/><circle cx="16.5" cy="11" r="1"/><path d="M3 12 6 8m-3 4 3 4"/>',
    'CRUSTÁCEOS': '<path d="M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4z"/><path d="M8 9 4 5M16 9l4-4M7 14H3m18 0h-4"/>',
    'SOJA': '<path d="M7 16a5 5 0 0 1 0-8c3-2 7-2 10 0a5 5 0 0 1 0 8c-3 2-7 2-10 0z"/><circle cx="10" cy="12" r="1.3"/><circle cx="14.5" cy="12" r="1.3"/>',
    'CASTANHAS': '<path d="M12 3c4 2 6 5 6 9s-2.7 9-6 9-6-5-6-9 2-7 6-9z"/><path d="M12 6v13"/>',
    'AMÊNDOAS': '<path d="M12 3c3.5 3 5 6 5 9.5S15 21 12 21s-5-5-5-8.5S8.5 6 12 3z"/>',
    'CORANTES': '<path d="M5 19a4 4 0 0 0 4-4c0-2 1-3 2-4l7-7 2 2-7 7c-1 1-2 2-4 2a4 4 0 0 0-4 4z"/><circle cx="7" cy="17" r="1"/>'
  };

  // Termos que descrevem restricao alimentar, nao ingrediente. Buscar por
  // "gluten" nao pode devolver uma lista que pareca uma classificacao segura:
  // devolve a orientacao correta, que e falar com a equipe.
  var TERMOS_RESTRICAO = [
    'gluten', 'lactose', 'alergia', 'alergias', 'alergico', 'alergica',
    'alergenos', 'alergeno', 'celiaco', 'celiaca', 'intolerancia',
    'intolerante', 'vegano', 'vegana', 'vegetariano', 'vegetariana',
    'sem gluten', 'sem lactose', 'sem leite', 'zero gluten', 'diabetico'
  ];

  function ehTermoDeRestricao(consulta) {
    var q = semAcento(consulta).trim();
    return TERMOS_RESTRICAO.some(function (t) {
      return q === t || q === 'sem ' + t || q.indexOf(t) === 0;
    });
  }

  function alergenoHTML(rotulo) {
    var glifo = GLIFOS[rotulo] || '<circle cx="12" cy="12" r="8"/>';
    return '<span class="alergeno">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + glifo + '</svg>' +
      esc(rotulo) + '</span>';
  }

  // -------------------------------------------------------------------------
  // Leitura dos dados
  // -------------------------------------------------------------------------

  // O catalogo publicado vem embutido na propria pagina: a primeira pintura
  // nao espera uma segunda requisicao, o que conta muito num celular com
  // 4G ruim na calcada da Beira-Mar. O arquivo em dados/cardapio.json e a
  // mesma saida e serve de reserva.
  function lerEstatico() {
    var embutido = document.getElementById('cardapio-dados');
    if (embutido && embutido.textContent.trim()) {
      try {
        return Promise.resolve(JSON.parse(embutido.textContent));
      } catch (e) { /* cai para o arquivo */ }
    }
    return fetch(CAMINHO_ESTATICO, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  // Le a publicacao ativa. A view cardapio_publico so devolve o que foi
  // publicado: rascunho, custo, margem e usuario interno nao passam por aqui.
  // A chave e a anonima, de leitura; nenhuma chave privilegiada vai ao
  // navegador.
  function lerAoVivo() {
    if (!SUPABASE_ANON) return Promise.reject(new Error('sem chave publica'));
    var url = SUPABASE_URL + '/rest/v1/cardapio_publico?select=versao,publicado_em,conteudo';
    var controle = new AbortController();
    var prazo = setTimeout(function () { controle.abort(); }, 6000);
    return fetch(url, {
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON },
      signal: controle.signal,
      cache: 'no-store'
    }).then(function (r) {
      clearTimeout(prazo);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (linhas) {
      if (!linhas || !linhas.length) throw new Error('sem publicacao ativa');
      var linha = linhas[0];
      var conteudo = linha.conteudo;
      conteudo.versao = linha.versao;
      conteudo.publicado_em = linha.publicado_em;
      return conteudo;
    });
  }

  // -------------------------------------------------------------------------
  // Desenho do catalogo
  // -------------------------------------------------------------------------

  function brasaoSVG() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"/>' +
      '<path d="M8.5 12c1.5-2 3.5-3 5-3s2.5.6 2.5 1.5-1 1.5-2.5 1.5-3.5 1-5 3"/></svg>';
  }

  function fotoHTML(produto, grande) {
    var classe = grande ? 'detalhe__foto' : 'item__foto';
    if (!produto.foto) {
      // Sem foto real o produto recebe o brasao, igual para todos. Nunca a
      // foto de outro prato para tapar o buraco.
      return '<div class="' + classe + ' ' + classe + '--vazia" role="img" ' +
        'aria-label="Ainda sem foto deste prato">' + brasaoSVG() + '</div>';
    }
    var f = produto.foto;
    // Foto enviada pelo painel vive no Storage e chega como URL pronta. Foto
    // antiga do site continua vindo por base + larguras, com avif/webp/jpg.
    if (f.url) {
      return '<div class="' + classe + '">' +
        '<img src="' + esc(f.url) + '" alt="' + esc(f.alt || '') + '" ' +
        'loading="lazy" decoding="async"></div>';
    }
    var base = '../assets/img/' + f.base + '-';
    var larguras = f.larguras;
    function conj(ext) {
      return larguras.map(function (w) { return base + w + '.' + ext + ' ' + w + 'w'; }).join(', ');
    }
    var tamanhos = grande ? '(max-width: 880px) 100vw, 880px' : '112px';
    return '<div class="' + classe + '"><picture>' +
      '<source type="image/avif" srcset="' + esc(conj('avif')) + '" sizes="' + tamanhos + '">' +
      '<source type="image/webp" srcset="' + esc(conj('webp')) + '" sizes="' + tamanhos + '">' +
      '<img src="' + esc(base + larguras[0] + '.jpg') + '" alt="' + esc(f.alt) + '" ' +
      'loading="lazy" decoding="async" width="' + larguras[0] + '" height="' + larguras[0] + '">' +
      '</picture></div>';
  }

  function precoHTML(produto) {
    var p = produto.preco;
    if (p.tipo === 'ausente') {
      return '<span class="item__preco"><small>Preço sob consulta</small></span>';
    }
    if (p.tipo === 'faixa') {
      return '<span class="item__preco">' + dinheiro(p.min) +
        ' <small>a ' + dinheiro(p.max) + '</small></span>';
    }
    return '<span class="item__preco">' + dinheiro(p.centavos) + '</span>';
  }

  function porcaoHTML(produto) {
    var p = produto.porcao;
    if (p.estado === 'informada' && p.texto) {
      return '<span class="item__porcao">' + esc(p.texto) + '</span>';
    }
    if (p.estado === 'em_conferencia') {
      return '<span class="item__porcao item__porcao--conferencia">Porção em conferência</span>';
    }
    return '';
  }

  function selosHTML(produto) {
    var selos = [];
    if (!produto.disponivel) {
      selos.push('<span class="selo selo--esgotado">Hoje não temos</span>');
    }
    produto.adicionais.forEach(function (a) {
      selos.push('<span class="selo selo--adicional">' + esc(a.nome) + ' + ' +
        dinheiro(a.preco_centavos) + '</span>');
    });
    return selos.join('');
  }

  function variantesHTML(produto) {
    if (!produto.variantes.length) return '';
    return '<ul class="variantes">' + produto.variantes.map(function (v) {
      return '<li><b>' + esc(v.nome) + '</b><span>' + dinheiro(v.preco_centavos) + '</span></li>';
    }).join('') + '</ul>';
  }

  function itemPrato(produto) {
    return '<li class="item item--prato' + (produto.disponivel ? '' : ' item--indisponivel') +
      '" id="item-' + esc(produto.id) + '">' +
      '<a class="item__link" href="#p-' + esc(produto.id) + '">' +
      fotoHTML(produto, false) +
      '<div class="item__texto">' +
      '<h3 class="item__nome">' + esc(produto.nome) + '</h3>' +
      (produto.descritor ? '<p class="item__descritor">' + esc(produto.descritor) + '</p>' : '') +
      (produto.descricao ? '<p class="item__descricao">' + esc(produto.descricao) + '</p>' : '') +
      '<div class="item__dados">' + precoHTML(produto) + porcaoHTML(produto) + '</div>' +
      variantesHTML(produto) +
      '<div class="item__rodape">' + selosHTML(produto) +
      '<span class="item__abrir">Ver detalhes' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
      '</span></div>' +
      '</div></a></li>';
  }

  function itemBebida(produto) {
    var medida = [];
    if (produto.porcao.estado === 'informada' && produto.porcao.texto) {
      medida.push(esc(produto.porcao.texto));
    } else if (produto.porcao.estado === 'em_conferencia') {
      medida.push('<span class="item__porcao--conferencia">Volume em conferência</span>');
    }
    if (produto.descritor && produto.descritor !== (produto.porcao.texto || '')) {
      medida.push(esc(produto.descritor));
    }
    if (produto.descricao) medida.push(esc(produto.descricao));
    if (!produto.disponivel) medida.unshift('<b>Hoje não temos</b>');
    return '<li class="item item--bebida' + (produto.disponivel ? '' : ' item--indisponivel') +
      '" id="item-' + esc(produto.id) + '">' +
      '<a class="item__link" href="#p-' + esc(produto.id) + '">' +
      '<h3 class="item__nome">' + esc(produto.nome) + '</h3>' +
      precoHTML(produto) +
      (medida.length ? '<p class="item__medida">' + medida.join(' · ') + '</p>' : '') +
      variantesHTML(produto) +
      '</a></li>';
  }

  function itemExtra(produto) {
    return '<li class="item item--extra' + (produto.disponivel ? '' : ' item--indisponivel') +
      '" id="item-' + esc(produto.id) + '">' +
      '<a class="item__link" href="#p-' + esc(produto.id) + '">' +
      '<h3 class="item__nome">' + esc(produto.nome) + '</h3>' +
      precoHTML(produto) +
      (produto.descritor ? '<p class="item__descricao">' + esc(produto.descritor) + '</p>' : '') +
      '</a></li>';
  }

  function moldeDaCategoria(cat) {
    if (cat.grupo === 'beber') return { item: itemBebida, lista: 'lista--bebidas' };
    if (cat.grupo === 'extras') return { item: itemExtra, lista: 'lista--extras' };
    return { item: itemPrato, lista: 'lista--pratos' };
  }

  function faixaHTML(cat) {
    if (!cat.faixa) return '';
    var f = cat.faixa;
    var texto = f.min === f.max
      ? f.itens + (f.itens === 1 ? ' opção · ' : ' opções · ') + dinheiro(f.min)
      : f.itens + ' opções · de ' + dinheiro(f.min) + ' a ' + dinheiro(f.max);
    return '<p class="secao__faixa">' + esc(texto) + '</p>';
  }

  function secaoHTML(cat, produtos) {
    var molde = moldeDaCategoria(cat);
    var daCat = produtos.filter(function (p) { return p.categoria === cat.id; });
    if (!daCat.length) return '';

    var corpo = '';
    if (cat.subgrupos && cat.subgrupos.length) {
      cat.subgrupos.forEach(function (sub) {
        var doSub = daCat.filter(function (p) { return p.subgrupo === sub.id; });
        if (!doSub.length) return;
        corpo += '<h3 class="subgrupo">' + esc(sub.nome) + '</h3>' +
          '<ul class="lista ' + molde.lista + '">' +
          doSub.map(molde.item).join('') + '</ul>';
      });
      var soltos = daCat.filter(function (p) { return !p.subgrupo; });
      if (soltos.length) {
        corpo += '<ul class="lista ' + molde.lista + '">' +
          soltos.map(molde.item).join('') + '</ul>';
      }
    } else {
      corpo = '<ul class="lista ' + molde.lista + '">' +
        daCat.map(molde.item).join('') + '</ul>';
    }

    return '<section class="secao" id="c-' + esc(cat.id) + '" ' +
      'aria-labelledby="t-' + esc(cat.id) + '" data-categoria="' + esc(cat.nome) + '">' +
      '<div class="secao__cabeca">' +
      '<h2 id="t-' + esc(cat.id) + '">' + esc(cat.nome) + '</h2>' +
      (cat.resumo ? '<p class="secao__resumo">' + esc(cat.resumo) + '</p>' : '') +
      faixaHTML(cat) +
      '</div>' + corpo + '</section>';
  }

  function desenharCatalogo() {
    var dados = estado.dados;
    var main = $('#catalogo');
    main.innerHTML = dados.categorias.map(function (cat) {
      return secaoHTML(cat, dados.produtos);
    }).join('') +
      '<a class="voltar-topo" href="#topo">Voltar ao começo do cardápio</a>';

    desenharAtalhos();
    desenharAviso();
    desenharRodape();
    observarSecoes();
  }

  function desenharAviso() {
    var alvo = $('#aviso-estado');
    if (!estado.dados.aviso_estado) { alvo.hidden = true; return; }
    alvo.hidden = false;
    alvo.innerHTML = '<div>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
      '<span>' + esc(estado.dados.aviso_estado) + '</span></div>';
  }

  function desenharAtalhos() {
    var dados = estado.dados;
    var lista = $('#atalhos');
    lista.innerHTML = dados.categorias.map(function (cat) {
      var n = dados.produtos.filter(function (p) { return p.categoria === cat.id; }).length;
      if (!n) return '';
      return '<li><a href="#c-' + esc(cat.id) + '">' + esc(cat.nome) +
        '<span class="conta">' + n + (n === 1 ? ' item' : ' itens') + '</span></a></li>';
    }).join('');
  }

  function desenharRodape() {
    var partes = [];
    estado.dados.avisos.forEach(function (a) {
      partes.push('<h2>' + esc(a.titulo) + '</h2><p>' + esc(a.texto) + '</p>');
    });
    var quando = dataCurta(estado.dados.publicado_em);
    if (estado.origemCopia === 'estatica' && quando) {
      partes.push('<p>Cardápio carregado da cópia salva em ' + esc(quando) +
        '. Confirme preços e disponibilidade com a equipe.</p>');
    } else if (quando) {
      partes.push('<p>Cardápio publicado em ' + esc(quando) + '.</p>');
    }
    partes.push('<div class="rodape__links">' +
      '<a href="../">Página do restaurante</a>' +
      '<a href="https://reservas.sirfisher.com.br/" data-evt="click_reservation">Reservar mesa</a>' +
      '<a href="../como-chegar/">Como chegar</a></div>');
    $('#rodape').innerHTML = partes.join('');
  }

  // Nome da secao atual na barra do topo: orientacao continua, sem o cliente
  // precisar tocar em nada.
  function observarSecoes() {
    var rotulo = $('#secao-atual');
    if (!('IntersectionObserver' in window)) return;
    var visiveis = new Map();
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        visiveis.set(e.target, e.isIntersecting ? e.boundingClientRect.top : Infinity);
      });
      var melhor = null, menor = Infinity;
      visiveis.forEach(function (topo, alvo) {
        if (topo < menor && topo !== Infinity) { menor = topo; melhor = alvo; }
      });
      if (melhor) {
        var nome = melhor.getAttribute('data-categoria');
        if (rotulo.textContent !== nome) {
          rotulo.textContent = nome;
          sinal('cardapio_categoria_vista', { categoria_nome: nome });
        }
      }
    }, { rootMargin: '-60px 0px -75% 0px', threshold: 0 });
    $$('.secao').forEach(function (s) { obs.observe(s); });
  }

  // -------------------------------------------------------------------------
  // Detalhe do produto
  // -------------------------------------------------------------------------

  function blocoLista(titulo, itens) {
    if (!itens || !itens.length) return '';
    return '<section class="bloco"><h2>' + esc(titulo) + '</h2><ul>' +
      itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') +
      '</ul></section>';
  }

  function blocoPrecos(titulo, linhas, nota) {
    if (!linhas || !linhas.length) return '';
    return '<section class="bloco"><h2>' + esc(titulo) + '</h2><ul class="linha-preco">' +
      linhas.map(function (l) {
        return '<li><b>' + esc(l.nome) + '</b><span class="valor">' +
          dinheiro(l.preco_centavos) + '</span></li>';
      }).join('') + '</ul>' +
      (nota ? '<p class="nota">' + esc(nota) + '</p>' : '') + '</section>';
  }

  function blocoPorcao(produto) {
    var p = produto.porcao;
    if (p.estado === 'em_conferencia') {
      return '<section class="bloco bloco--conferencia"><h2>Porção</h2>' +
        '<p>Esta medida está em conferência com a cozinha. Pergunte ao garçom ' +
        'antes de pedir.</p></section>';
    }
    if (p.estado === 'nao_informada') {
      return '<section class="bloco bloco--conferencia"><h2>Porção</h2>' +
        '<p>Ainda não temos a medida cadastrada para este item. A equipe informa ' +
        'na hora do pedido.</p></section>';
    }
    var linhas = [];
    if (p.texto) linhas.push('<p><b>' + esc(p.texto) + '</b></p>');
    if (p.detalhes && p.detalhes.length) {
      linhas.push('<ul>' + p.detalhes.map(function (d) {
        return '<li>' + esc(d) + '</li>';
      }).join('') + '</ul>');
    }
    if (p.nota) linhas.push('<p class="nota">' + esc(p.nota) + '</p>');
    // Peso nao vira numero de pessoas: sao informacoes diferentes e o
    // rendimento nao foi confirmado por ninguem.
    return '<section class="bloco"><h2>Porção</h2>' + linhas.join('') + '</section>';
  }

  function blocoAlimentar(produto) {
    var a = produto.alimentar;
    var corpo = '';
    if (a.declarados.length) {
      corpo += '<div class="alergenos">' + a.declarados.map(alergenoHTML).join('') + '</div>';
    }
    corpo += '<p class="nota">' + esc(a.texto) + '</p>';
    if (a.confirmado.length) {
      corpo += '<p><b>Confirmado pela cozinha:</b> ' + esc(a.confirmado.join(', ')) + '</p>';
    }
    if (a.contato_cruzado.length) {
      corpo += '<p><b>Risco de contato cruzado confirmado:</b> ' +
        esc(a.contato_cruzado.join(', ')) + '</p>';
    }
    return '<section class="bloco bloco--alimentar"><h2>Informação alimentar</h2>' +
      corpo + '</section>';
  }

  function abrirDetalhe(id) {
    var produto = estado.dados.produtos.filter(function (p) { return p.id === id; })[0];
    if (!produto) { fecharDetalhe(true); return; }

    var cat = estado.dados.categorias.filter(function (c) {
      return c.id === produto.categoria;
    })[0] || { nome: '' };

    var painel = $('#detalhe');
    var corpo = $('#detalhe-corpo');

    var preco = produto.preco.tipo === 'faixa'
      ? dinheiro(produto.preco.min) + ' a ' + dinheiro(produto.preco.max)
      : (produto.preco.centavos !== null ? dinheiro(produto.preco.centavos) : 'Preço sob consulta');

    corpo.innerHTML =
      fotoHTML(produto, true) +
      '<div class="detalhe__cabeca">' +
      '<p class="detalhe__categoria">' + esc(cat.nome) + '</p>' +
      '<h1 id="detalhe-titulo">' + esc(produto.nome) + '</h1>' +
      (produto.descritor ? '<p class="detalhe__descritor">' + esc(produto.descritor) + '</p>' : '') +
      '<p class="detalhe__preco">' + esc(preco) + '</p>' +
      (!produto.disponivel
        ? '<p><span class="selo selo--esgotado">Hoje não temos este item</span></p>' : '') +
      '</div>' +
      '<div class="detalhe__texto"><p>' +
      esc(produto.detalhe || produto.descricao || '') + '</p></div>' +
      blocoPorcao(produto) +
      blocoLista('Já vem com', produto.inclui) +
      blocoLista('Você escolhe', produto.opcoes.map(function (o) { return o.texto; })) +
      blocoPrecos('Opções e preços', produto.variantes,
        'Diga ao garçom qual você prefere.') +
      blocoPrecos('Adicionais', produto.adicionais,
        'Valor somado ao preço do prato, se você pedir.') +
      blocoAlimentar(produto) +
      '<section class="bloco"><h2>Como pedir</h2><p>Peça ao garçom pelo nome: ' +
      '<b>' + esc(produto.nome) + '</b>' +
      (produto.descritor ? ' — ' + esc(produto.descritor) : '') +
      '.</p></section>';

    estado.rolagemGuardada = window.scrollY;
    painel.hidden = false;
    document.body.style.overflow = 'hidden';
    painel.scrollTop = 0;
    $('#detalhe-voltar').focus();
    sinal('cardapio_detalhe_aberto', {
      produto_id: produto.id, categoria: produto.categoria
    });
  }

  function fecharDetalhe(semHistorico) {
    var painel = $('#detalhe');
    if (painel.hidden) return;
    painel.hidden = true;
    document.body.style.overflow = '';
    if (semHistorico) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo(0, estado.rolagemGuardada);
  }

  function tratarHash() {
    var h = location.hash;
    if (h.indexOf('#p-') === 0) {
      abrirDetalhe(h.slice(3));
    } else {
      fecharDetalhe(false);
    }
  }

  // -------------------------------------------------------------------------
  // Atalhos e busca
  // -------------------------------------------------------------------------

  function alternarPainel(botao, painel) {
    var abrindo = painel.hidden;
    $$('.painel').forEach(function (p) { p.hidden = true; });
    $$('.botao-topo').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    painel.hidden = !abrindo;
    botao.setAttribute('aria-expanded', String(abrindo));
    if (abrindo && painel.id === 'painel-busca') $('#busca').focus();
  }

  function buscar(consulta) {
    var alvo = $('#busca-saida');
    var termo = consulta.trim();

    if (termo.length < 2) {
      alvo.innerHTML = '<p class="busca-dica">Digite ao menos duas letras. ' +
        'Você também pode fechar a busca e rolar o cardápio inteiro.</p>';
      return;
    }

    // Restricao alimentar nao e filtro de produto. O portal nao classifica
    // nada como seguro: manda falar com quem tem a ficha.
    if (ehTermoDeRestricao(termo)) {
      alvo.innerHTML = '<div class="busca-vazia">' +
        '<p><b>Sobre alergias e restrições, fale com a equipe.</b></p>' +
        '<p>As marcações que aparecem em cada prato vêm do cardápio impresso e ' +
        'ainda não foram conferidas com a cozinha. Por isso o cardápio não ' +
        'separa pratos por restrição alimentar. Chame o garçom: ele consulta ' +
        'os ingredientes com a cozinha.</p></div>';
      sinal('cardapio_busca', { resultados: 0, tipo: 'restricao_alimentar' });
      return;
    }

    var palavras = semAcento(termo).split(/\s+/).filter(Boolean);
    var achados = estado.dados.produtos.filter(function (p) {
      return palavras.every(function (w) { return p.busca.indexOf(w) !== -1; });
    });

    sinal('cardapio_busca', { resultados: achados.length, tipo: 'produto' });

    if (!achados.length) {
      alvo.innerHTML = '<div class="busca-vazia">' +
        '<p><b>Não encontramos esse termo no cardápio.</b></p>' +
        '<p>Tente o nome de um ingrediente, como <i>camarão</i> ou <i>peixe</i>. ' +
        'Você também pode fechar a busca e ver os itens por categoria.</p></div>';
      return;
    }

    var mapa = {};
    estado.dados.categorias.forEach(function (c) { mapa[c.id] = c.nome; });
    alvo.innerHTML = '<p class="busca-dica">' + achados.length +
      (achados.length === 1 ? ' item encontrado' : ' itens encontrados') + '</p>' +
      '<ul class="busca-resultados">' + achados.map(function (p) {
        var preco = p.preco.tipo === 'faixa'
          ? dinheiro(p.preco.min) + ' a ' + dinheiro(p.preco.max)
          : dinheiro(p.preco.centavos);
        return '<li><a href="#item-' + esc(p.id) + '" data-fechar-busca>' +
          '<span class="nome">' + esc(p.nome) + '</span> ' +
          '<span class="onde">' + esc(mapa[p.categoria]) + ' · ' + esc(preco) +
          (p.disponivel ? '' : ' · hoje não temos') + '</span></a></li>';
      }).join('') + '</ul>';
  }

  // -------------------------------------------------------------------------
  // Atualizacao sem sobressalto
  // -------------------------------------------------------------------------

  function ofereceAtualizacao(novo) {
    estado.pendente = novo;
    var barra = $('#atualizacao');
    barra.hidden = false;
    barra.innerHTML = '<div class="painel__corpo">' +
      '<p style="margin:0 0 10px">O cardápio foi atualizado pelo restaurante.</p>' +
      '<button class="botao" id="aplicar-atualizacao" type="button">Ver o cardápio atualizado</button>' +
      '</div>';
    $('#aplicar-atualizacao').addEventListener('click', function () {
      estado.dados = estado.pendente;
      estado.pendente = null;
      estado.origemCopia = 'aovivo';
      barra.hidden = true;
      desenharCatalogo();
      window.scrollTo(0, 0);
      sinal('cardapio_atualizado_aplicado', { versao: estado.dados.versao });
    });
  }

  function conferirAoVivo() {
    lerAoVivo().then(function (novo) {
      estado.carregadoEm = Date.now();
      if (!estado.dados) {
        estado.dados = novo;
        estado.origemCopia = 'aovivo';
        desenharCatalogo();
        return;
      }
      if (novo.versao && estado.dados.versao && novo.versao > estado.dados.versao) {
        // Nada se move sozinho embaixo de quem esta lendo: o cliente decide
        // quando trocar.
        ofereceAtualizacao(novo);
      } else {
        estado.origemCopia = 'aovivo';
        desenharRodape();
      }
    }).catch(function () {
      // Sem rede ou sem publicacao ativa: a copia estatica ja esta na tela e
      // o rodape diz de quando ela e.
    });
  }

  function copiaVelha() {
    var quando = estado.dados && estado.dados.publicado_em;
    if (!quando) return false;
    var dias = (Date.now() - new Date(quando).getTime()) / 86400000;
    return dias > DIAS_COPIA_VELHA;
  }

  // -------------------------------------------------------------------------
  // Falha de carregamento
  // -------------------------------------------------------------------------

  function mostrarFalha() {
    $('#catalogo').innerHTML =
      '<div class="estado-falha">' +
      '<h2>Não conseguimos carregar o cardápio</h2>' +
      '<p>Verifique a conexão do celular e tente novamente. O garçom também pode ' +
      'trazer o cardápio impresso.</p>' +
      '<p><button class="botao" type="button" id="tentar-de-novo">Tentar de novo</button></p>' +
      '</div>';
    $('#tentar-de-novo').addEventListener('click', function () {
      location.reload();
    });
    sinal('cardapio_falha_carga', {});
  }

  // -------------------------------------------------------------------------
  // Ligacao
  // -------------------------------------------------------------------------

  function ligarControles() {
    $('#btn-categorias').addEventListener('click', function () {
      alternarPainel(this, $('#painel-categorias'));
    });
    $('#btn-busca').addEventListener('click', function () {
      alternarPainel(this, $('#painel-busca'));
    });

    var campo = $('#busca');
    var atraso;
    campo.addEventListener('input', function () {
      clearTimeout(atraso);
      var valor = this.value;
      atraso = setTimeout(function () { buscar(valor); }, 180);
    });
    $('#busca-form').addEventListener('submit', function (e) {
      e.preventDefault();
      buscar(campo.value);
    });
    $('#busca-limpar').addEventListener('click', function () {
      campo.value = '';
      buscar('');
      campo.focus();
    });

    // Fechar atalho ou busca ao escolher um destino.
    document.addEventListener('click', function (e) {
      var alvo = e.target.closest ? e.target.closest('a') : null;
      if (!alvo) return;
      if (alvo.closest('#painel-categorias') || alvo.hasAttribute('data-fechar-busca')) {
        $$('.painel').forEach(function (p) { p.hidden = true; });
        $$('.botao-topo').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      }
    });

    $('#detalhe-voltar').addEventListener('click', function () {
      if (history.length > 1) history.back();
      else fecharDetalhe(true);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#detalhe').hidden) {
        if (history.length > 1) history.back(); else fecharDetalhe(true);
        return;
      }
      var aberto = $$('.painel').filter(function (p) { return !p.hidden; })[0];
      if (aberto) {
        aberto.hidden = true;
        $$('.botao-topo').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      }
    });

    window.addEventListener('hashchange', tratarHash);

    // Pagina esquecida aberta na mesa: ao voltar para ela, confere se saiu
    // publicacao nova antes que o cliente leia um preco vencido.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (!estado.carregadoEm || Date.now() - estado.carregadoEm > 600000) {
        conferirAoVivo();
      }
    });
  }

  // Pre-visualizacao vinda do painel. O operador ve o rascunho no portal de
  // verdade, com o mesmo desenho que o cliente tera, em vez de uma imitacao
  // mantida em paralelo. Origem conferida; fora do modo previa, ignorado.
  function ligarPrevia() {
    if (new URLSearchParams(location.search).get('previa') !== '1') return;
    window.addEventListener('message', function (ev) {
      if (ev.origin !== ORIGEM_PREVIA) return;
      var msg = ev.data;
      if (!msg || msg.tipo !== 'cardapio-previa' || !msg.dados) return;
      estado.dados = msg.dados;
      estado.origemCopia = 'previa';
      desenharCatalogo();
      var aviso = $('#aviso-estado');
      aviso.hidden = false;
      aviso.innerHTML = '<div><span><b>Pré-visualização do rascunho.</b> ' +
        'Só você está vendo isto; o cliente continua vendo a versão publicada.' +
        '</span></div>';
      window.scrollTo(0, 0);
    });
    try {
      (window.opener || window.parent).postMessage(
        { tipo: 'cardapio-previa-pronto' }, ORIGEM_PREVIA);
    } catch (e) { /* sem painel do outro lado */ }
  }

  function iniciar() {
    ligarControles();
    ligarPrevia();
    sinal('cardapio_aberto', {
      origem: new URLSearchParams(location.search).get('utm_source') || 'direto'
    });

    lerEstatico().then(function (dados) {
      estado.dados = dados;
      estado.origemCopia = 'estatica';
      estado.carregadoEm = Date.now();
      desenharCatalogo();
      if (location.hash) tratarHash();
      if (copiaVelha()) conferirAoVivo();
      else setTimeout(conferirAoVivo, 1200);
    }).catch(function () {
      lerAoVivo().then(function (dados) {
        estado.dados = dados;
        estado.origemCopia = 'aovivo';
        estado.carregadoEm = Date.now();
        desenharCatalogo();
        if (location.hash) tratarHash();
      }).catch(mostrarFalha);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
