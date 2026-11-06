(() => {
  'use strict';

  const foods = [
    { name: '牛肉麵', image: 'images/foods/01-beef-noodles.jpg', shops: ['林東芳牛肉麵｜臺北市中山區八德路二段322號', '老山東牛肉家常麵店｜臺北市萬華區西寧南路70號B1'] },
    { name: '小籠包', image: 'images/foods/02-xiaolongbao.jpg', shops: ['鼎泰豐（信義店）｜臺北市大安區信義路二段194號', '杭州小籠湯包｜臺北市大安區杭州南路二段17號'] },
    { name: '滷肉飯', image: 'images/foods/03-braised-pork-rice.jpg', shops: ['金峰魯肉飯｜臺北市中正區羅斯福路一段10號', '天天利美食坊｜臺北市萬華區漢中街32巷1號'] },
    { name: '蚵仔煎', image: 'images/foods/04-oyster-omelet.jpg', shops: ['圓環邊蚵仔煎｜臺北市大同區寧夏路46號', '寧夏夜市｜臺北市大同區寧夏路一帶'] },
    { name: '蔥抓餅', image: 'images/foods/05-scallion-pancake.jpg', shops: ['天津蔥抓餅｜臺北市大安區永康街6巷1號', '師園鹽酥雞｜臺北市大安區師大路39巷14號'] },
    { name: '臭豆腐', image: 'images/foods/06-stinky-tofu.jpg', shops: ['王記府城肉粽｜臺北市大同區南京西路185巷20號', '深坑老街｜新北市深坑區深坑街'] },
    { name: '珍珠奶茶', image: 'images/foods/07-bubble-tea.jpg', shops: ['春水堂（臺北信義店）｜臺北市信義區松壽路9號', '五十嵐｜臺北市多處分店'] },
    { name: '雞排', image: 'images/foods/08-fried-chicken.jpg', shops: ['豪大大雞排（士林夜市）｜臺北市士林區基河路一帶', '師園鹽酥雞｜臺北市大安區師大路39巷14號'] },
    { name: '芒果冰', image: 'images/foods/09-mango-ice.jpg', shops: ['Smoothie House 思慕昔（永康店）｜臺北市大安區永康街15號', '冰讚｜臺北市大同區雙連街2號'] },
    { name: '胡椒餅', image: 'images/foods/10-pepper-bun.jpg', shops: ['福州世祖胡椒餅（饒河店）｜臺北市松山區饒河街249號', '福元胡椒餅｜臺北市大同區華陰街42-19號'] },
    { name: '芋圓', image: 'images/foods/11-taro-balls.jpg', shops: ['阿柑姨芋圓｜新北市瑞芳區豎崎路5號', '九份老街｜新北市瑞芳區基山街一帶'] },
    { name: '鳳梨酥', image: 'images/foods/12-pineapple-cake.jpg', shops: ['佳德糕餅｜臺北市松山區南京東路五段88號', '微熱山丘（臺北民生公園店）｜臺北市松山區民生東路五段36巷4弄1號'] },
  ];

  const attractions = [
    { name: '臺北101', address: '臺北市信義區信義路五段7號', description: '臺灣最具代表性的地標，觀景臺可鳥瞰全臺北，周邊精品百貨環繞。', image: 'images/attractions/01-taipei-101.jpg' },
    { name: '國父紀念館', address: '臺北市信義區仁愛路四段505號', description: '擁有開闊的廣場，是遠眺與拍攝101的絕佳角度，衛兵交接極具特色。', image: 'images/attractions/02-sun-yat-sen-memorial.jpg' },
    { name: '中正紀念堂', address: '臺北市中正區中山南路21號', description: '宏偉的藍白建築與自由廣場，平日適合散步，也是大型藝文市集常駐地。', image: 'images/attractions/03-chiang-kai-shek-memorial.jpg' },
    { name: '西門町', address: '臺北市萬華區成都路、漢中街一帶', description: '青少年潮流、街頭藝人與流行文化的發源地，必拍彩虹馬路與西門紅樓。', image: 'images/attractions/04-ximending.jpg' },
    { name: '大稻埕碼頭', address: '臺北市大同區民生西路底（淡水河畔）', description: '傍晚黃昏的夕陽非常美麗，貨櫃市集提供異國美食與微醺調酒。', image: 'images/attractions/05-dadaocheng-wharf.jpg' },
    { name: '松山文創園區', address: '臺北市信義區光復南路133號', description: '舊菸廠改建的松菸，融合古蹟建築與誠品行旅，常有設計大展。', image: 'images/attractions/06-songshan-cultural-park.jpg' },
    { name: '華山1914文創園區', address: '臺北市中正區八德路一段1號', description: '紅磚牆與綠藤蔓交織，充滿獨立咖啡廳、文創小店與展演空間。', image: 'images/attractions/07-huashan-1914.jpg' },
    { name: '迪化街', address: '臺北市大同區迪化街一段', description: '保存完美的百年巴洛克老建築，近年翻轉進駐許多中藥文創店與文青茶館。', image: 'images/attractions/08-dihua-street.jpg' },
    { name: '剝皮寮歷史街區', address: '臺北市萬華區廣州街101號', description: '位於萬華，重現清代與日治時期的紅磚街道，為電影《艋舺》取景地。', image: 'images/attractions/09-bopiliao.jpg' },
    { name: '榕錦時光生活園區', address: '臺北市中正區金華街3號', description: '日式老宿舍群變身的小京都，有精緻餐飲、和服體驗與質感小店。', image: 'images/attractions/10-rongjin.jpg' },
    { name: '赤峰街', address: '臺北市大同區赤峰街一帶', description: '捷運中山站旁的打鐵老街，現已變成獨立服飾店與文青甜點的天堂。', image: 'images/attractions/11-chifeng-street.jpg' },
    { name: '陽明山國家公園', address: '臺北市北投區竹子湖路1-20號（遊客中心）', description: '臺北的後花園，一年四季都有不同風景，如小油坑的火山地質奇景。', image: 'images/attractions/12-yangmingshan.jpg' },
    { name: '擎天崗草原', address: '臺北市士林區菁山路101巷246號', description: '一望無際的翠綠大草原，經常能看到野放的水牛群，非常適合野餐。', image: 'images/attractions/13-qingtiangang.jpg' },
    { name: '象山步道', address: '臺北市信義區信義路五段150巷22弄', description: '只需步行20分鐘即可登頂，是拍攝101全景與都市日落的最佳觀景臺。', image: 'images/attractions/14-elephant-mountain.jpg' },
    { name: '大安森林公園', address: '臺北市大安區新生南路二段1號', description: '臺北市中心的都市之肺，擁有大片草皮、生態池及豐富的鳥類生態。', image: 'images/attractions/15-daan-forest-park.jpg' },
    { name: '北投地熱谷', address: '臺北市北投區中山路30號', description: '溫泉源頭之一，終年瀰漫著如仙境般的青磺泉白煙與硫磺味。', image: 'images/attractions/16-beitou-thermal-valley.jpg' },
    { name: '貓空', address: '臺北市文山區指南路三段38巷（纜車貓空站）', description: '搭乘透明的水晶纜車上山，一邊品嚐在地鐵觀音茶，一邊遠眺臺北盆地。', image: 'images/attractions/17-maokong.jpg' },
    { name: '國立故宮博物院', address: '臺北市士林區至善路二段221號', description: '享譽國際的文化寶庫，收藏數千年華夏歷史珍寶，如翠玉白菜。', image: 'images/attractions/18-national-palace-museum.jpg' },
    { name: '臺北市立美術館', address: '臺北市中山區中山北路三段181號', description: '位於圓山，純白現代的幾何建築，是當代藝術愛好者的必訪之地。', image: 'images/attractions/19-taipei-fine-arts-museum.jpg' },
    { name: '臺北植物園', address: '臺北市中正區南海路53號', description: '歷史悠久的植物園，內有古色古香的欽差行臺與荷花池。', image: 'images/attractions/20-taipei-botanical-garden.jpg' },
    { name: '國家兩廳院', address: '臺北市中正區中山南路21-1號', description: '宮殿式的雄偉建築，是臺灣藝文表演的最高殿堂。', image: 'images/attractions/21-national-theater.jpg' },
    { name: '臺北市立動物園', address: '臺北市文山區新光路二段30號', description: '全臺規模最大的動物園，大貓熊、企鵝與非洲動物區深受小朋友喜愛。', image: 'images/attractions/22-taipei-zoo.jpg' },
    { name: '兒童新樂園', address: '臺北市士林區承德路五段55號', description: '臺北專屬的兒童主題樂園，旋轉木馬、摩天輪等遊樂設施價格非常親民。', image: 'images/attractions/23-childrens-amusement-park.jpg' },
    { name: '士林夜市', address: '臺北市士林區基河路101號周邊', description: '臺北規模最大夜市，傳統小吃與逛街店家極多，國際旅客必訪。', image: 'images/attractions/24-shilin-night-market.jpg' },
    { name: '寧夏夜市', address: '臺北市大同區寧夏路58號周邊', description: '以在地傳統臺灣小吃「純密度最高」著稱，千歲宴與蛋黃芋餅非常有名。', image: 'images/attractions/25-ningxia-night-market.jpg' },
  ];

  const credits = window.TOPIC_IMAGE_CREDITS || {};

  function addImageCredit(container, group, index) {
    const credit = credits[group]?.[index];
    if (!credit) return;
    const link = document.createElement('a');
    link.className = 'image-credit';
    link.href = credit.sourceUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = credit.creditText || `圖片：${credit.author} · ${credit.license}`;
    link.setAttribute('aria-label', credit.ariaLabel || `圖片來源：${credit.author}，${credit.license}，開啟維基共享資源`);
    container.appendChild(link);
  }

  const foodGrid = document.querySelector('#foodGrid');
  foods.forEach((food, index) => {
    const article = document.createElement('article');
    article.className = 'food-card';
    const button = document.createElement('button');
    button.className = 'food-flip';
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${food.name}，點擊查看推薦店家`);

    const inner = document.createElement('span');
    inner.className = 'food-flip-inner';
    const front = document.createElement('span');
    front.className = 'food-face food-front';
    const image = document.createElement('img');
    image.src = credits.foods?.[index]?.file || food.image;
    image.alt = '';
    image.loading = 'lazy';
    const name = document.createElement('span');
    name.className = 'food-name';
    name.textContent = food.name;
    front.append(image, name);

    const back = document.createElement('span');
    back.className = 'food-face food-back';
    const number = document.createElement('span');
    number.className = 'food-back-number';
    number.textContent = `NO. ${String(index + 1).padStart(2, '0')}`;
    const backTitle = document.createElement('span');
    backTitle.className = 'food-back-title';
    backTitle.textContent = `${food.name}推薦`;
    const shopList = document.createElement('span');
    shopList.className = 'food-shops';
    food.shops.forEach((shop) => {
      const item = document.createElement('span');
      item.className = 'food-shop';
      item.textContent = shop;
      shopList.appendChild(item);
    });
    back.append(number, backTitle, shopList);
    addImageCredit(back, 'foods', index);
    inner.append(front, back);
    button.appendChild(inner);
    button.addEventListener('click', () => {
      const isFlipped = button.classList.toggle('is-flipped');
      button.setAttribute('aria-pressed', String(isFlipped));
    });
    article.appendChild(button);
    foodGrid.appendChild(article);
  });

  const attractionGrid = document.querySelector('#attractionGrid');
  attractions.forEach((place, index) => {
    const article = document.createElement('article');
    article.className = 'attraction-card';
    const stamp = document.createElement('button');
    stamp.className = 'attraction-stamp';
    stamp.type = 'button';
    stamp.setAttribute('aria-expanded', 'false');
    stamp.setAttribute('aria-label', `展開${place.name}的景點介紹`);


    const figure = document.createElement('figure');
    figure.className = 'attraction-photo';
    const image = document.createElement('img');
    image.src = credits.attractions?.[index]?.file || place.image;
    image.alt = `${place.name}景點照片`;
    image.loading = 'lazy';
    figure.appendChild(image);
    stamp.append(figure);

    const pullout = document.createElement('div');
    pullout.className = 'attraction-pullout';
    const details = document.createElement('div');
    details.className = 'attraction-details';
    details.id = `attraction-details-${index + 1}`;
    const title = document.createElement('h3');
    title.textContent = place.name;
    const address = document.createElement('p');
    address.className = 'attraction-address';
    address.textContent = place.address;
    const description = document.createElement('p');
    description.className = 'attraction-description';
    description.textContent = place.description;
    details.append(title, address, description);
    addImageCredit(details, 'attractions', index);
    pullout.append(details);
    stamp.setAttribute('aria-controls', details.id);
    article.append(stamp, pullout);
    stamp.addEventListener('click', () => {
      const isExpanded = article.classList.toggle('is-expanded');
      article.classList.toggle('is-collapsed', !isExpanded);
      stamp.setAttribute('aria-expanded', String(isExpanded));
      stamp.setAttribute('aria-label', `${isExpanded ? '收合' : '展開'}${place.name}的景點介紹`);
    });
    article.addEventListener('pointerenter', () => {
      if (!article.classList.contains('is-collapsed')) stamp.setAttribute('aria-expanded', 'true');
    });
    article.addEventListener('pointerleave', () => {
      if (!article.classList.contains('is-expanded') && !article.contains(document.activeElement)) {
        stamp.setAttribute('aria-expanded', 'false');
      }
    });
    article.addEventListener('focusin', () => {
      if (!article.classList.contains('is-collapsed')) stamp.setAttribute('aria-expanded', 'true');
    });
    article.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!article.classList.contains('is-expanded') && !article.matches(':hover') && !article.contains(document.activeElement)) {
          stamp.setAttribute('aria-expanded', 'false');
        }
      });
    });
    attractionGrid.appendChild(article);
  });

  const topButton = document.querySelector('#topicsTop');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const updateTopButton = () => {
    const isVisible = window.scrollY > 420;
    topButton.classList.toggle('is-visible', isVisible);
    topButton.setAttribute('aria-hidden', String(!isVisible));
    topButton.tabIndex = isVisible ? 0 : -1;
  };
  topButton.addEventListener('click', () => {
    if (topButton.classList.contains('is-launching')) return;
    topButton.classList.add('is-launching');
    window.setTimeout(() => {
      topButton.classList.remove('is-launching');
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }, reduceMotion ? 0 : 700);
  });
  window.addEventListener('scroll', updateTopButton, { passive: true });
  updateTopButton();

  const topGhostPupils = topButton.querySelectorAll('.top-ghost-pupil');
  document.addEventListener('pointermove', (event) => {
    const bounds = topButton.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.42)));
    const y = Math.max(-1, Math.min(1, (event.clientY - (bounds.top + bounds.height * 0.43)) / (bounds.height * 0.3)));
    topGhostPupils.forEach((pupil) => {
      pupil.style.left = `${28.7 + x * 25}%`;
      pupil.style.top = `${29.7 + y * 24}%`;
    });
  }, { passive: true });

  const blinkTopGhost = () => {
    if (topButton.classList.contains('is-visible')) {
      topButton.classList.add('is-blinking');
      window.setTimeout(() => topButton.classList.remove('is-blinking'), 140);
    }
    window.setTimeout(blinkTopGhost, 1800 + Math.random() * 3200);
  };
  window.setTimeout(blinkTopGhost, 1200 + Math.random() * 1800);
})();
