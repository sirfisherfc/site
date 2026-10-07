/* ===========================================================================
   Sir Fisher | Menu in English
   ---------------------------------------------------------------------------
   Le os MESMOS dados do cardapio em portugues (copia estatica e, depois, a
   publicacao ativa do painel) e troca so os textos, por id do produto. Preco,
   porcao, disponibilidade e foto vem sempre da publicacao: a versao em ingles
   nunca guarda preco proprio, entao nao tem como ficar desatualizada.

   Produto novo sem traducao aparece com o nome em portugues e o aviso
   "Name in Portuguese". Para traduzir, acrescente o id em PRODUTOS abaixo.
   O nome original vai sempre embaixo, para o cliente pedir ao garcom.
   =========================================================================== */

(function () {
  'use strict';

  var CAMINHO_ESTATICO = '../../cardapio/dados/cardapio.json';
  var SUPABASE_URL = 'https://lucpxoynpvogkvzepagi.supabase.co';
  // Mesma chave anonima e de leitura do cardapio em portugues (cardapio.js).
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y3B4b3lucHZvZ2t2emVwYWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDYxNzQsImV4cCI6MjA5OTE4MjE3NH0.r0XGYX1KqAXQA4g9uoUAFLFTEaWUEXobWqyKVe0_SnE';

  var CATEGORIAS = {
    'fish-and-chips': { nome: 'Fish & Chips', resumo: 'The house dish, in two different batters.' },
    'petiscos': { nome: 'Starters and sharing plates', resumo: 'To share at the table while the conversation flows.' },
    'sanduiches': { nome: 'Sandwiches', resumo: 'On brioche buns, served individually.' },
    'para-dividir': { nome: 'Mains to share', resumo: 'Served on a platter with rice, fries (or cassava), salad, farota and house-made sauce.' },
    'sobremesas': { nome: 'Desserts and coffee', resumo: 'Something sweet to finish.' },
    'cervejas': { nome: 'Beer', resumo: 'Long necks, 600 mL bottles and draught beer.' },
    'coqueteis': { nome: 'Cocktails', resumo: 'Classics and house creations.' },
    'sem-alcool': { nome: 'Soft drinks', resumo: 'Water, juices, sodas and energy drinks.' },
    'doses': { nome: 'Spirits', resumo: 'Served as 50 mL shots.' },
    'extras': { nome: 'Extras and charges', resumo: 'Add-ons, take-away items and house charges.' }
  };

  var SUBGRUPOS = {
    'mar': 'From the sea',
    'terra': 'From the land',
    'fritas': 'Fries and sides',
    'comestiveis': 'Add-ons',
    'apoio': 'Take-away and ice',
    'cobrancas': 'Charges'
  };

  var COM_ARROZ = ['Rice', 'Fries or cassava', 'Salad', 'Farota', 'House-made sauce'];
  var FRITAS_OU_MACAXEIRA = ['Fries or cassava'];
  var ADD_FRITAS = { 'Adicionar batata frita': 'Add fries' };
  var ARROZ_EXTRA = { 'Arroz extra': 'Extra rice' };
  var VODKAS = { 'Vodka nacional': 'Brazilian vodka' };

  // nome, descritor, descricao, inclui, opcoes, variantes e adicionais
  // (estes dois por nome em portugues). Campo ausente = texto original.
  var PRODUTOS = {
    'sir-fisher-fish-n-chips': { nome: 'Sir Fisher — Fish & Chips', descritor: 'acoupa weakfish in a panko crust, with fries', descricao: 'Pescada amarela (acoupa weakfish) in panko breadcrumbs, crisp outside and juicy inside. Served with fries.' },
    'london-fish-n-chips': { nome: 'London — Fish & Chips', descritor: 'fish in a beer batter, with fries', descricao: 'Fish in a light beer batter, fried until golden. Served with crispy fries.' },
    'patinha-de-caranguejo': { nome: 'Crab Claws', descricao: 'Breaded, crispy crab claws. Served with fries and house sauce.', inclui: ['Fries', 'House sauce'] },
    'bolinha-de-peixe-cremosa': { nome: 'Creamy Fish Balls', descricao: 'Six pescada amarela balls with a creamy cream cheese filling.' },
    'newcastle': { nome: 'NewCastle', descritor: 'breaded prawns with fries', descricao: 'Crispy outside, in panko breadcrumbs. Inspired by the streets of London.', inclui: ['Portion of fries'] },
    'crocante-carne-de-sol': { nome: 'Carne de Sol and Pumpkin Croquettes', descricao: 'Six crispy croquettes in a light pumpkin dough, with a creamy filling of carne de sol (salted, sun-dried beef).' },
    'crocante-calabresa': { nome: 'Calabresa Sausage and Leek Croquettes', descricao: 'Six crispy croquettes filled with fried calabresa (Brazilian smoked sausage) and leek.' },
    'big-ben-fries': { nome: 'Big Ben Fries', descritor: 'fries with creamy cheddar and bacon' },
    'pasteizinhos': { nome: 'Mini Pastéis', descricao: 'Ten crispy mini pastries with special sauce. Choose one filling.', inclui: ['Special sauce'], opcoes: ['Two cheeses', 'Beef', 'Prawn'] },
    'crispy-spicy-chicken': { nome: 'Crispy Spicy Chicken', descritor: 'breaded chicken rolls filled with cheese', descricao: 'Marinated in spices and fried to order. Served with a creamy sauce.', inclui: ['Creamy sauce'] },
    'file-mignon-trinchado': { nome: 'Sliced Filet Mignon', descricao: 'Filet mignon with sautéed onions, served with fries or golden cassava.', opcoes: FRITAS_OU_MACAXEIRA },
    'caldo-de-peixe': { nome: 'Fish Broth', descricao: 'Pescada amarela broth, light and full of flavour.' },
    'camarao-alho-e-oleo': { nome: 'Garlic Prawns', descricao: 'Large prawns sautéed in garlic and oil.' },
    'dadinho-de-tapioca': { nome: 'Tapioca Cubes (Dadinho)', descricao: 'Twelve tapioca cubes, crisp outside and soft inside, with special sauce.', inclui: ['Special sauce'] },
    'calabresa-acebolada-com-fritas': { nome: 'Calabresa Sausage with Onions and Fries', descricao: 'Calabresa (Brazilian smoked sausage) with onions and a generous portion of fries or crispy cassava.', opcoes: FRITAS_OU_MACAXEIRA },
    'macaxeira-ou-batata-frita': { nome: 'Fried Cassava or Fries', descricao: 'Golden fried cassava or fries. Choose one.', opcoes: ['Fried cassava', 'Fries'] },
    'isca-de-peixe': { nome: 'Fish Strips', descricao: 'Strips of pescada amarela breaded in panko, with special sauce.', inclui: ['Special sauce'] },
    'fisher-burger': { nome: 'Fisher Burger', descritor: 'breaded pescada amarela burger', descricao: 'On a brioche bun, with pickles and special sauce.', adicionais: ADD_FRITAS },
    'edimburger': { nome: 'Edimburger', descritor: '120 g beef patty with bacon', descricao: 'On a brioche bun, with lettuce, tomato, special mayonnaise and cheddar.', adicionais: ADD_FRITAS },
    'marine-sandwich': { nome: 'Marine Sandwich', descritor: 'sautéed prawns with breaded cream cheese', descricao: 'With aioli, lettuce and cucumber, on a brioche bun.', adicionais: ADD_FRITAS },
    'file-mignon-dividir': { nome: 'Filet Mignon', descricao: 'Juicy filet mignon, with Madeira sauce or cooked in garlic and oil.', inclui: COM_ARROZ, adicionais: ARROZ_EXTRA, opcoes: FRITAS_OU_MACAXEIRA },
    'picanha-importada': { nome: 'Imported Picanha (Top Sirloin Cap)', descricao: 'Imported picanha, char-grilled for flavour and juiciness.', inclui: COM_ARROZ, adicionais: ARROZ_EXTRA, opcoes: FRITAS_OU_MACAXEIRA },
    'file-de-peixe-grelhado': { nome: 'Grilled Fish Fillet', descricao: 'Grilled pescada amarela fillet, light and full of flavour.', inclui: COM_ARROZ, adicionais: ARROZ_EXTRA, opcoes: FRITAS_OU_MACAXEIRA },
    'carne-de-sol-acebolada': { nome: 'Carne de Sol with Onions', descricao: 'Prime carne de sol (salted, sun-dried beef) with golden onions.', inclui: COM_ARROZ, adicionais: ARROZ_EXTRA, opcoes: FRITAS_OU_MACAXEIRA },
    'peito-de-frango-com-ervas': { nome: 'Herb Chicken Breast', descricao: 'Chicken breast seasoned with fine herbs and char-grilled.', inclui: COM_ARROZ, adicionais: ARROZ_EXTRA, opcoes: FRITAS_OU_MACAXEIRA },
    'picanha-suina': { nome: 'Pork Picanha', descricao: 'Char-grilled pork picanha.', inclui: COM_ARROZ, adicionais: ARROZ_EXTRA, opcoes: FRITAS_OU_MACAXEIRA },
    'brownie-de-chocolate': { nome: 'Chocolate Brownie', descricao: 'Soft brownie made with high-quality chocolate.' },
    'brownie-com-sorvete': { nome: 'Brownie with Ice Cream', descricao: 'Chocolate brownie with cream ice cream and chocolate sauce.' },
    'cafe-expresso': { nome: 'Espresso' },
    'chope-brahma': { nome: 'Brahma Draught Beer', descritor: 'draught' },
    'spaten-longneck': { nome: 'Spaten Long Neck', descritor: 'long neck' },
    'stella-artois-longneck': { nome: 'Stella Artois Long Neck', descritor: 'long neck' },
    'corona-longneck': { nome: 'Corona Long Neck', descritor: 'long neck' },
    'corona-zero-longneck': { nome: 'Corona Zero Long Neck', descritor: 'long neck, alcohol-free' },
    'spaten-600': { nome: 'Spaten 600', descritor: 'bottle' },
    'original-600': { nome: 'Original 600', descritor: 'bottle' },
    'budweiser-600': { nome: 'Budweiser 600', descritor: 'bottle' },
    'stella-artois-600': { nome: 'Stella Artois 600', descritor: 'bottle' },
    'stella-pure-gold-600': { nome: 'Stella Pure Gold 600', descritor: 'bottle' },
    'caipirinha': { nome: 'Caipirinha', descritor: 'lime, sugar and cachaça', variantes: { 'Cachaça nacional': 'Brazilian cachaça' } },
    'caipiroska': { nome: 'Caipiroska', descritor: 'lime, sugar and vodka', variantes: VODKAS },
    'caipifruta': { nome: 'Caipifruta', descritor: 'vodka, sugar and fruit pulp', variantes: VODKAS, opcoes: ['Pineapple, acerola, cashew fruit, cajá, passion fruit, strawberry or mango (pulp)'] },
    'gin-tonica': { nome: 'Gin and Tonic', descritor: 'gin, tonic water and a citrus touch', variantes: { 'Gin nacional': 'Brazilian gin' } },
    'melancita': { nome: 'Melancita', descritor: 'gin, watermelon energy drink and lemon' },
    'sherlock-holmes-gin': { nome: 'Sherlock Holmes Gin', descritor: 'gin with energy drink and ginger' },
    'tropicall': { nome: 'Tropicall', descritor: 'vodka, tropical energy drink and lemon' },
    'margarita': { nome: 'Margarita', descritor: 'tequila, triple sec and lime' },
    'fitzgerald': { nome: 'Fitzgerald', descritor: 'gin, lime, sugar and house-made bitters' },
    'moscow-mule': { nome: 'Moscow Mule', descritor: 'vodka, ginger and lime' },
    'smirnoff-ice': { nome: 'Smirnoff Ice' },
    'agua-sem-gas': { nome: 'Still Water' },
    'agua-com-gas': { nome: 'Sparkling Water' },
    'agua-de-coco-copo': { nome: 'Coconut Water' },
    'agua-tonica': { nome: 'Tonic Water' },
    'refrigerante-lata': { nome: 'Soda (can)', descritor: 'choose a flavour', opcoes: ['Guaraná, Guaraná Zero, Pepsi, Pepsi Black, orange, grape or lemon soda'] },
    'suco-copo': { nome: 'Juice (glass)', descritor: 'made from fruit pulp, choose a flavour', opcoes: ['Acerola, pineapple, cajá, cashew fruit, lime, passion fruit, strawberry or mango (pulp)'] },
    'energetico-red-bull': { nome: 'Red Bull Energy Drink' },
    'soda-italiana': { nome: 'Italian Soda', descritor: 'alcohol-free, choose a flavour', opcoes: ['Green apple, tangerine, ginger, grenadine or cranberry'] },
    'sumo-de-limao': { nome: 'Lime Juice Shot', descritor: '50 mL' },
    'teachers': { nome: "Teacher's" },
    'black-white': { nome: 'Black & White' },
    'red-label': { nome: 'Red Label' },
    'black-label': { nome: 'Black Label' },
    'rum': { nome: 'Rum', opcoes: ['Bacardi or Montila'] },
    'campari': { nome: 'Campari' },
    'martini': { nome: 'Martini', opcoes: ['Bianco or Rosato'] },
    'vodka-nacional': { nome: 'Brazilian Vodka' },
    'vodka-sky': { nome: 'Sky Vodka' },
    'vodka-absolut': { nome: 'Absolut Vodka' },
    'gin-nacional': { nome: 'Brazilian Gin' },
    'gin-gordons': { nome: "Gordon's Gin" },
    'aperol': { nome: 'Aperol' },
    'conhaque': { nome: 'Brandy (Conhaque)' },
    'cachaca-nacional': { nome: 'Brazilian Cachaça' },
    'cachaca-ypioca-150': { nome: 'Cachaça Ypioca 150' },
    'cachaca-premium': { nome: 'Premium Cachaça', opcoes: ['Batista (3 years in oak, MG), Gogó da Ema (2 years in balsam wood, AL), Matriarca (2 years in umburana wood, BA) or Caipira 5 Estrelas (1 year in cherry wood, ES)'] },
    'molho-extra': { nome: 'Extra Sauce', descritor: 'extra portion of sauce' },
    'arroz-extra': { nome: 'Extra Rice', descritor: 'extra portion of rice' },
    'rolha': { nome: 'Corkage', descritor: 'fee for drinks brought by guests' },
    'pacote-gelo': { nome: 'Bag of Ice', descritor: 'bag of ice' },
    'embalagem-viagem': { nome: 'Take-away Container', descritor: 'container to take food home' }
  };

  var ALERGENOS = {
    'PEIXE': 'fish', 'GLÚTEN': 'gluten', 'OVO': 'egg', 'LACTOSE': 'lactose',
    'CRUSTÁCEOS': 'crustaceans', 'CORANTES': 'food colouring'
  };

  // Porcoes: termos que aparecem no campo de texto livre.
  var TERMOS_PORCAO = [
    [/Dose de (\d+) mL/g, '$1 mL shot'],
    [/Copo (\d+) mL/g, '$1 mL glass'],
    [/(\d+) unidades/g, '$1 pieces'],
    [/ de proteína/g, ' of protein'],
    [/ de carne/g, ' of meat']
  ];

  function $(sel) { return document.querySelector(sel); }

  function esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function reais(centavos) {
    if (centavos === null || centavos === undefined) return '';
    return 'R$ ' + (centavos / 100).toFixed(2);
  }

  function porcaoEN(texto) {
    if (!texto) return '';
    var s = String(texto);
    TERMOS_PORCAO.forEach(function (par) { s = s.replace(par[0], par[1]); });
    return s;
  }

  function precoEN(p) {
    if (!p.preco) return '';
    if (p.preco.tipo === 'faixa') return reais(p.preco.min) + ' – ' + reais(p.preco.max);
    if (p.preco.centavos === null || p.preco.centavos === undefined) return 'Ask the team';
    return reais(p.preco.centavos);
  }

  function fotoHTML(produto) {
    var f = produto.foto;
    if (!f) return '';
    var alt = 'Photo of ' + produto._nomeEN;
    if (f.url) {
      return '<div class="mi__foto"><img src="' + esc(f.url) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"></div>';
    }
    if (!f.base || !f.larguras || !f.larguras.length) return '';
    var base = '../../assets/img/' + f.base + '-';
    var w = f.larguras[0];
    return '<div class="mi__foto"><picture>' +
      '<source type="image/avif" srcset="' + esc(base + w + '.avif') + '">' +
      '<source type="image/webp" srcset="' + esc(base + w + '.webp') + '">' +
      '<img src="' + esc(base + w + '.jpg') + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" width="96" height="96">' +
      '</picture></div>';
  }

  function itemHTML(p) {
    var tr = PRODUTOS[p.id] || {};
    p._nomeEN = tr.nome || p.nome;
    var linhas = [];
    var descritor = tr.descritor || (tr.nome ? '' : p.descritor);
    var descricao = tr.descricao || (tr.nome ? '' : p.descricao);
    if (descritor) linhas.push('<p class="mi__descritor">' + esc(descritor) + '</p>');
    if (descricao) linhas.push('<p class="mi__texto">' + esc(descricao) + '</p>');

    var inclui = tr.inclui || p.inclui || [];
    if (inclui.length) linhas.push('<p class="mi__meta"><b>Includes:</b> ' + esc(inclui.join(', ')) + '</p>');
    var opcoes = tr.opcoes || (p.opcoes || []).map(function (o) { return o.texto; });
    if (opcoes.length) linhas.push('<p class="mi__meta"><b>Options:</b> ' + esc(opcoes.join('; ')) + '</p>');

    if (p.variantes && p.variantes.length) {
      linhas.push('<ul class="mi__var">' + p.variantes.map(function (v) {
        var nome = (tr.variantes && tr.variantes[v.nome]) || v.nome;
        return '<li><span>' + esc(nome) + '</span><b>' + reais(v.preco_centavos) + '</b></li>';
      }).join('') + '</ul>');
    }
    if (p.adicionais && p.adicionais.length) {
      linhas.push('<p class="mi__meta">' + p.adicionais.map(function (a) {
        var nome = (tr.adicionais && tr.adicionais[a.nome]) || a.nome;
        return esc(nome) + ': +' + reais(a.preco_centavos);
      }).join(' · ') + '</p>');
    }

    var alerg = (p.alimentar && p.alimentar.declarados) || [];
    if (alerg.length) {
      linhas.push('<p class="mi__alerg">Contains (per printed menu): ' +
        esc(alerg.map(function (a) { return ALERGENOS[a] || a.toLowerCase(); }).join(', ')) + '</p>');
    }

    var medida = porcaoEN(p.porcao && p.porcao.texto);
    var original = tr.nome && tr.nome !== p.nome
      ? '<p class="mi__original" lang="pt-BR">Ask for: <i>' + esc(p.nome) + '</i></p>'
      : (!tr.nome ? '<p class="mi__original">Name in Portuguese</p>' : '');

    return '<li class="mi' + (p.disponivel === false ? ' mi--off' : '') + '">' +
      fotoHTML(p) +
      '<div class="mi__corpo">' +
        '<div class="mi__topo"><h3 class="mi__nome"' + (tr.nome ? '' : ' lang="pt-BR"') + '>' + esc(p._nomeEN) + '</h3>' +
        '<span class="mi__preco">' + esc(precoEN(p)) + '</span></div>' +
        (medida ? '<p class="mi__medida">' + esc(medida) + '</p>' : '') +
        (p.disponivel === false ? '<p class="mi__off">Not available today</p>' : '') +
        linhas.join('') + original +
      '</div></li>';
  }

  function desenhar(dados) {
    var cats = (dados.categorias || []).filter(function (c) {
      return dados.produtos.some(function (p) { return p.categoria === c.id; });
    });

    $('#mn-nav').innerHTML = cats.map(function (c) {
      var nome = (CATEGORIAS[c.id] && CATEGORIAS[c.id].nome) || c.nome;
      return '<a href="#m-' + esc(c.id) + '">' + esc(nome) + '</a>';
    }).join('');

    $('#mn-lista').innerHTML = cats.map(function (c) {
      var tc = CATEGORIAS[c.id] || {};
      var produtos = dados.produtos
        .filter(function (p) { return p.categoria === c.id; })
        .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      var grupos = (c.subgrupos && c.subgrupos.length)
        ? c.subgrupos.map(function (s) {
            return { titulo: SUBGRUPOS[s.id] || s.nome, itens: produtos.filter(function (p) { return p.subgrupo === s.id; }) };
          }).concat([{ titulo: '', itens: produtos.filter(function (p) {
            return !c.subgrupos.some(function (s) { return s.id === p.subgrupo; });
          }) }])
        : [{ titulo: '', itens: produtos }];
      return '<section class="mn-cat" id="m-' + esc(c.id) + '">' +
        '<h2>' + esc(tc.nome || c.nome) + '</h2>' +
        ((tc.resumo || c.resumo) ? '<p class="mn-cat__resumo">' + esc(tc.resumo || c.resumo) + '</p>' : '') +
        grupos.filter(function (g) { return g.itens.length; }).map(function (g) {
          return (g.titulo ? '<h3 class="mn-sub">' + esc(g.titulo) + '</h3>' : '') +
            '<ul class="mn-itens">' + g.itens.map(itemHTML).join('') + '</ul>';
        }).join('') +
        '</section>';
    }).join('');

    var conferencia = dados.estado === 'em_conferencia';
    $('#mn-estado').hidden = !conferencia;
    if (dados.publicado_em) {
      var d = new Date(dados.publicado_em);
      if (!isNaN(d)) {
        $('#mn-data').textContent = 'Menu published on ' + d.toLocaleDateString('en-US', {
          timeZone: 'America/Fortaleza', day: 'numeric', month: 'long', year: 'numeric'
        }) + '.';
      }
    }
  }

  function lerEstatico() {
    return fetch(CAMINHO_ESTATICO, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function lerAoVivo() {
    var controle = new AbortController();
    var prazo = setTimeout(function () { controle.abort(); }, 6000);
    return fetch(SUPABASE_URL + '/rest/v1/cardapio_publico?select=versao,publicado_em,conteudo', {
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON },
      signal: controle.signal,
      cache: 'no-store'
    }).then(function (r) {
      clearTimeout(prazo);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (linhas) {
      if (!linhas || !linhas.length) throw new Error('no active menu');
      var c = linhas[0].conteudo;
      c.versao = linhas[0].versao;
      c.publicado_em = linhas[0].publicado_em;
      return c;
    });
  }

  var desenhado = null;
  function talvezDesenhar(dados) {
    if (!dados || !dados.produtos) return;
    if (desenhado && new Date(desenhado.publicado_em) >= new Date(dados.publicado_em)) return;
    desenhado = dados;
    desenhar(dados);
  }

  lerEstatico().then(talvezDesenhar).catch(function () {})
    .then(function () { return lerAoVivo(); })
    .then(talvezDesenhar)
    .catch(function () {
      if (!desenhado) $('#mn-lista').innerHTML = '<p class="mn-erro">The menu could not be loaded. ' +
        '<a href="../../cardapio/" hreflang="pt-BR">Open the menu in Portuguese</a>.</p>';
    });
})();
