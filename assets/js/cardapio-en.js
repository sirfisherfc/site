/* ===========================================================================
   Sir Fisher | Cardapio em ingles
   ---------------------------------------------------------------------------
   Traducao do MESMO cardapio de /cardapio/, aberto com ?lang=en. Aqui ficam
   so textos: preco, porcao, foto, disponibilidade e ordem continuam vindo da
   publicacao do painel, entao a versao em ingles nunca fica desatualizada.

   Produto novo sem traducao aparece com o texto em portugues. Para traduzir,
   acrescente o id em PRODUTOS (nome, descritor, descricao e, se houver,
   inclui/opcoes na mesma ordem dos dados, variantes/adicionais pelo nome em
   portugues). O nome original aparece sempre junto, para pedir ao garcom.
   =========================================================================== */

(function () {
  'use strict';

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

  // Rotulos de alergeno: a chave continua a do cardapio impresso (escolhe o
  // icone); so o texto exibido muda.
  var ALERGENOS = {
    'GLÚTEN': 'GLUTEN', 'LACTOSE': 'LACTOSE', 'LEITE': 'MILK', 'OVO': 'EGG',
    'PEIXE': 'FISH', 'CRUSTÁCEOS': 'CRUSTACEANS', 'SOJA': 'SOY',
    'CASTANHAS': 'TREE NUTS', 'AMÊNDOAS': 'ALMONDS', 'CORANTES': 'COLOURINGS'
  };

  var ALERGENOS_DESCRICAO = {
    'GLÚTEN': 'Found in pasta, breaded dishes (panko), beer and bread.',
    'LACTOSE': 'Found in dairy products (cheese, butter, sauces).',
    'LEITE': 'Found in cheese, sauces and desserts.',
    'OVO': 'Found in batters, breaded dishes, mayonnaise and desserts.',
    'PEIXE': 'Pescada amarela and fish broth.',
    'CRUSTÁCEOS': 'Prawns and crab.',
    'SOJA': 'Found in house sauces and cooking oils.',
    'CASTANHAS': 'Nuts and nut products.',
    'AMÊNDOAS': 'Dried fruit and preparations.',
    'CORANTES': 'Food colourings in drinks and syrups.'
  };

  // Frases fixas que vem dos dados publicados (texto exato -> ingles).
  var FRASES = {
    'Cardápio em conferência. Confirme preços e porções com a equipe.': 'Menu under review. Please confirm prices and portions with the team.',
    'Peso em conferência com a cozinha.': 'Weight being confirmed with the kitchen.',
    'O cardápio impresso informa “peso in natura”. Alcance por prato ainda em conferência.': 'The printed menu gives the raw weight. The cooked portion is still being confirmed.',
    'Marcações transcritas do cardápio impresso, ainda não conferidas com a cozinha. Consulte a equipe sobre alérgenos.': 'Markings copied from the printed menu and not yet checked by the kitchen. Please ask the team about allergens.',
    'O cardápio impresso informa “peso in natura”. Alcance por prato ainda em conferência. O impresso não delimita se os 300 g são da carne ou do prato montado.': 'The printed menu gives the raw weight. The cooked portion is still being confirmed, and the printed menu does not say whether the 300 g refers to the meat or the whole plate.',
    'O cardápio impresso informa “peso in natura”. Alcance por prato ainda em conferência. O impresso não delimita se os 250 g são da calabresa ou do prato montado.': 'The printed menu gives the raw weight. The cooked portion is still being confirmed, and the printed menu does not say whether the 250 g refers to the sausage or the whole plate.',
    'O cardápio impresso informa “peso in natura”. Alcance por prato ainda em conferência. O impresso não informa quantas pessoas o prato serve.': 'The printed menu gives the raw weight. The cooked portion is still being confirmed, and the printed menu does not say how many people it serves.',
    'Nenhuma fonte informa peso ou quantidade.': 'Weight or quantity not yet listed.',
    'Nenhuma fonte informa o volume deste coquetel.': 'The volume of this cocktail is not yet listed.',
    'Este item não tem marcações no cardápio impresso. Isso não significa ausência de alérgenos. Consulte a equipe.': 'This item has no markings on the printed menu. That does not mean it is free of allergens. Please ask the team.',
    'Informação alimentar ainda não revisada para este item. Consulte a equipe.': 'Dietary information not yet reviewed for this item. Please ask the team.'
  };
  var AVISO_ESTADO_PADRAO = 'Menu under review. Please confirm prices and portions with the team.';

  // Medidas em texto livre.
  var PORCAO = [
    [/Dose de (\d+) mL/g, '$1 mL shot'],
    [/Copo (\d+) mL/g, '$1 mL glass'],
    [/(\d+) unidades/g, '$1 pieces'],
    [/(\d+) bolinhos/g, '$1 croquettes'],
    [/ no total/g, ' in total'],
    [/ de proteína/g, ' of protein'],
    [/ de carne/g, ' of meat']
  ];

  var UI = {
    titulo: 'Sir Fisher menu | Fortaleza seafront',
    descricao: 'The full Sir Fisher menu in English, with current prices in Brazilian reais: fish and chips, prawns, sharing plates, cocktails and drinks on the Beira-Mar in Fortaleza, Brazil.',
    pular: 'Skip to the menu',
    secaoPadrao: 'Menu',
    categorias: 'Sections',
    buscar: 'Search',
    abasRotulo: 'Menu sections',
    abasEsq: 'Scroll sections left',
    abasDir: 'Scroll sections right',
    categoriasTitulo: 'Menu sections',
    buscaTitulo: 'Search the menu',
    buscaPlaceholder: 'Dish or ingredient, e.g. prawn',
    buscaRotulo: 'Search by dish or ingredient',
    limpar: 'Clear',
    buscaInicial: 'Search is optional. You can close it and scroll through the whole menu.',
    carregando: 'Loading the menu…',
    voltarCardapio: 'Back to the menu',
    trocarIdioma: 'Cardápio em português →',
    semEstoque: 'Not available today',
    semEstoqueItem: 'This item is not available today',
    contem: 'Contains',
    verDetalhes: 'See details',
    item: 'item',
    itens: 'items',
    legendaTitulo: 'Allergen key',
    legendaIntro: 'Main ingredients found in the menu items:',
    legendaAviso: '<p><strong>ALLERGIES:</strong> All our dishes and drinks are prepared in the same kitchen. Even dishes without the listed ingredients <strong>may contain traces of gluten, prawns, fish, egg, soy and milk through cross-contact</strong>. If you have a severe allergy or dietary restriction, please tell our team before ordering.</p>',
    voltarTopo: 'Back to the top of the menu',
    rodapeCasa: '<p><strong>Good to know:</strong> Prices are in Brazilian reais (R$). We do not accept cheques. &bull; The 10% service charge is optional (Brazilian Federal Law 13,419/2017).</p>' +
      '<p><strong>Payment:</strong> Cash, Pix, debit and credit cards (Visa, Mastercard, Elo, Hipercard, American Express), including foreign cards.</p>' +
      '<p><strong>Consumer protection:</strong> DECON-CE 0800 275 8001 / +55 85 3459-6320 &bull; PROCON Fortaleza 151.</p>',
    linkRestaurante: 'Restaurant page',
    linkReservar: 'Book a table',
    linkChegar: 'Directions',
    linkLigar: 'Call',
    medidaConferencia: 'Portion being confirmed',
    porcao: 'Portion',
    contemLista: 'Contains: ',
    confirmadoCozinha: 'Confirmed by the kitchen:',
    alimentarPadrao: 'If you have a severe allergy or dietary restriction, always ask our team before ordering.',
    alimentarTitulo: 'Dietary information',
    precoConsulta: 'Ask for the price',
    jaVemCom: 'Comes with',
    voceEscolhe: 'You choose',
    opcoesPrecos: 'Options and prices',
    opcoesNota: 'Tell your server which one you prefer.',
    adicionais: 'Add-ons',
    adicionaisNota: 'Added to the price of the dish if you order it.',
    nomeOriginal: 'On the Portuguese menu:',
    buscaCurta: 'Type at least two letters. You can also close the search and scroll through the whole menu.',
    buscaRestricao: '<p><b>For allergies and dietary restrictions, please talk to the team.</b></p><p>All our dishes are prepared in the same kitchen. For your safety, if you have an allergy or food intolerance, ask our team before ordering.</p>',
    buscaVazia: '<p><b>We couldn’t find that on the menu.</b></p><p>Try an ingredient, such as <i>prawn</i> or <i>fish</i>. You can also close the search and browse by section.</p>',
    encontrado: 'item found',
    encontrados: 'items found',
    hojeNaoTemos: 'not available today',
    atualizado: 'The restaurant has updated the menu.',
    verAtualizado: 'See the updated menu',
    falhaTitulo: 'We couldn’t load the menu',
    falhaTexto: 'Check your phone’s connection and try again. Your server can also bring the printed menu.',
    tentarDeNovo: 'Try again'
  };

  window.SF_CARDAPIO_EN = {
    categorias: CATEGORIAS,
    subgrupos: SUBGRUPOS,
    produtos: PRODUTOS,
    alergenos: ALERGENOS,
    alergenosDescricao: ALERGENOS_DESCRICAO,
    frases: FRASES,
    avisoEstadoPadrao: AVISO_ESTADO_PADRAO,
    porcao: PORCAO,
    ui: UI
  };
})();
