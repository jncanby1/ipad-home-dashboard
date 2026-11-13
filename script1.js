
/* Home & Faith V2 — ES5-compatible JavaScript for older Safari */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function txt(id, value) { el(id).textContent = value; }
  function on(id, event, fn) {
    el(id).addEventListener(event, fn, false);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dateFromISO(s) {
    var a = s.split('-');
    return new Date(+a[0], +a[1] - 1, +a[2]);
  }
  function safeGet(key, fallback) {
    try {
      var v = localStorage.getItem('homefaith_v2_' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try {
      localStorage.setItem('homefaith_v2_' + key, JSON.stringify(value));
    } catch (e) {}
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function node(tag, cls, value) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (typeof value !== 'undefined') n.textContent = value;
    return n;
  }
  function formatTime(s) {
    if (!s) return '--:--';
    var a = s.split(':'), h = +a[0];
    return (h % 12 || 12) + ':' + a[1] + (h >= 12 ? ' PM' : ' AM');
  }
  function hourLabel(s) {
    return formatTime(s.slice(11, 16)).replace(':00', '').replace(' ', '');
  }

  /* CLOCK AND GREETING */
  var today = new Date(), todayISO = iso(today);

  function clock() {
    var d = new Date(), h = d.getHours();
    txt('greeting',
      (h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening') + ', Jordan!'
    );
    txt('today', d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }));
    txt('clock', (h % 12 || 12) + ':' + pad(d.getMinutes()));
    txt('period', h >= 12 ? 'PM' : 'AM');
    document.body.className = h < 6 || h >= 20 ? 'night' : h < 10 ? 'morning' : '';
    if (iso(d) !== todayISO) {
      todayISO = iso(d);
      renderWeek();
      renderReading();
      renderVerse();
    }
  }
  clock();
  setInterval(clock, 30000);

  /* WEATHER — Open-Meteo, no API key */
  var city = safeGet('city', {
    name: 'Shepherdstown, WV',
    lat: 39.4301,
    lon: -77.8042
  });

  function condition(code) {
    if (code === 0) return 'Clear skies';
    if (code <= 3) return 'Partly cloudy';
    if (code === 45 || code === 48) return 'Foggy';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    if (code >= 95) return 'Thunderstorms';
    return 'Changing skies';
  }
  function iconFor(code) {
    if (code === 0) return '☀';
    if (code <= 3) return '⛅';
    if (code <= 48) return '☁';
    if (code <= 67) return '☂';
    if (code <= 77) return '❄';
    if (code <= 82) return '☂';
    if (code <= 86) return '❄';
    return '⚡';
  }

  function api(url, success, failure) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 13000;
    x.onreadystatechange = function () {
      if (x.readyState === 4) {
        if (x.status >= 200 && x.status < 300) {
          try { success(JSON.parse(x.responseText)); }
          catch (e) { failure(); }
        } else { failure(); }
      }
    };
    x.ontimeout = failure;
    x.onerror = failure;
    try { x.send(); } catch (e) { failure(); }
  }

  function loadWeather() {
    txt('weather-status', 'Loading ' + city.name + '...');
    var url = 'https://api.open-meteo.com/v1/forecast?latitude='
      + encodeURIComponent(city.lat)
      + '&longitude=' + encodeURIComponent(city.lon)
      + '&current=temperature_2m,weather_code'
      + '&hourly=temperature_2m,precipitation_probability,weather_code'
      + '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max'
      + '&temperature_unit=fahrenheit&timezone=auto&forecast_days=2';

    api(url, function (w) {
      if (!w.current || !w.daily || !w.hourly) {
        weatherFail();
        return;
      }
      txt('temp', Math.round(w.current.temperature_2m) + '°');
      txt('conditions', condition(w.current.weather_code));
      txt('highlow', 'High ' + Math.round(w.daily.temperature_2m_max[0])
        + '° · Low ' + Math.round(w.daily.temperature_2m_min[0]) + '°');
      txt('rain', Math.round(w.daily.precipitation_probability_max[0] || 0) + '%');
      txt('sunrise', formatTime(w.daily.sunrise[0].slice(11, 16)));
      txt('sunset', formatTime(w.daily.sunset[0].slice(11, 16)));
      txt('weather-status', city.name + ' · Live forecast');

      var list = el('hourly');
      clear(list);
      var currentHour = w.current.time.slice(0, 13);
      var start = 0, i;
      for (i = 0; i < w.hourly.time.length; i++) {
        if (w.hourly.time[i].slice(0, 13) >= currentHour) {
          start = i;
          break;
        }
      }
      for (i = start; i < Math.min(start + 5, w.hourly.time.length); i++) {
        var item = node('div', 'hour'),
          t = node('small', '', i === start ? 'NOW' : hourLabel(w.hourly.time[i])),
          ic = node('span', 'hour-icon', iconFor(w.hourly.weather_code[i])),
          v = node('strong', '', Math.round(w.hourly.temperature_2m[i]) + '°');
        item.appendChild(t);
        item.appendChild(ic);
        item.appendChild(v);
        list.appendChild(item);
      }
    }, weatherFail);
  }

  function weatherFail() {
    txt('weather-status', city.name + ' · Weather unavailable');
    txt('conditions', 'Could not load forecast');
    clear(el('hourly'));
    el('hourly').appendChild(node('span', 'muted',
      'Check Wi-Fi or Safari compatibility.'));
  }

  on('weather-settings', 'click', function () {
    el('city-form').className =
      el('city-form').className.indexOf('hidden') >= 0
        ? 'settings-line' : 'settings-line hidden';
    el('city').value = city.name.split(',')[0];
  });

  on('city-form', 'submit', function (e) {
    e.preventDefault();
    var name = el('city').value.replace(/^\s+|\s+$/g, '');
    if (!name) return;
    txt('weather-status', 'Finding ' + name + '...');
    api('https://geocoding-api.open-meteo.com/v1/search?name='
      + encodeURIComponent(name) + '&count=1&language=en&format=json',
      function (data) {
        if (!data.results || !data.results.length) {
          txt('weather-status', 'City not found. Try a nearby town.');
          return;
        }
        var r = data.results[0];
        city = {
          name: r.name + (r.admin1 ? ', ' + r.admin1 : ''),
          lat: r.latitude, lon: r.longitude
        };
        save('city', city);
        el('city-form').className = 'settings-line hidden';
        loadWeather();
      },
      function () { txt('weather-status', 'City search unavailable'); }
    );
  });
  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);

  /* CALENDAR — events saved on this iPad */
  var events = safeGet('events', []), selected = todayISO;

  function renderWeek() {
    var box = el('week');
    clear(box);
    var now = new Date();
    var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var offset = (base.getDay() + 6) % 7;
    base.setDate(base.getDate() - offset);

    for (var i = 0; i < 7; i++) {
      var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      var s = iso(d);
      var b = node('button', 'day'
        + (s === selected ? ' selected' : '')
        + (s === todayISO ? ' today' : ''));
      b.type = 'button';
      b.setAttribute('data-date', s);
      b.appendChild(node('span', '',
        ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]));
      b.appendChild(node('b', '', d.getDate()));
      b.onclick = function () {
        selected = this.getAttribute('data-date');
        renderWeek();
        renderEvents();
      };
      box.appendChild(b);
    }
    renderEvents();
  }

  function renderEvents() {
    var list = el('events');
    clear(list);
    var chosen = dateFromISO(selected);
    txt('agenda-date', chosen.toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    }));

    var dayEvents = [];
    for (var i = 0; i < events.length; i++) {
      if (events[i].date === selected) dayEvents.push(events[i]);
    }
    dayEvents.sort(function (a, b) {
      return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
    });
    txt('agenda-count', dayEvents.length + ' event'
      + (dayEvents.length === 1 ? '' : 's'));

    if (!dayEvents.length) {
      list.appendChild(node('li', 'muted',
        'Nothing scheduled. Enjoy the breathing room.'));
      return;
    }

    for (i = 0; i < dayEvents.length; i++) {
      var ev = dayEvents[i],
        li = node('li'),
        time = node('span', 'event-time', formatTime(ev.time)),
        name = node('span', 'event-name', ev.title),
        del = node('button', 'delete', '×');
      del.type = 'button';
      del.setAttribute('data-id', ev.id);
      del.setAttribute('aria-label', 'Delete ' + ev.title);
      del.onclick = function () {
        var id = this.getAttribute('data-id'), keep = [];
        for (var j = 0; j < events.length; j++)
          if (String(events[j].id) !== id) keep.push(events[j]);
        events = keep;
        save('events', events);
        renderEvents();
      };
      li.appendChild(time);
      li.appendChild(name);
      li.appendChild(del);
      list.appendChild(li);
    }
  }

  el('event-date').value = todayISO;
  el('event-time').value = '09:00';
  on('event-form', 'submit', function (e) {
    e.preventDefault();
    var d = el('event-date').value,
      t = el('event-time').value,
      title = el('event-title').value.replace(/^\s+|\s+$/g, '');
    if (!d || !t || !title) return;
    events.push({
      id: String(new Date().getTime()) + String(Math.floor(Math.random() * 1000)),
      date: d, time: t, title: title
    });
    save('events', events);
    selected = d;
    el('event-title').value = '';
    renderWeek();
  });
  renderWeek();

  /* FAITH — King James Version */
  var verses = [
    { text: 'Peace I leave with you, my peace I give unto you.',
      ref: 'John 14:27 · KJV' },
    { text: 'Be still, and know that I am God.',
      ref: 'Psalm 46:10 · KJV' },
    { text: 'The LORD is my shepherd; I shall not want.',
      ref: 'Psalm 23:1 · KJV' },
    { text: 'I can do all things through Christ which strengtheneth me.',
      ref: 'Philippians 4:13 · KJV' },
    { text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.',
      ref: 'Proverbs 3:5 · KJV' },
    { text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.',
      ref: 'Psalm 118:24 · KJV' },
    { text: 'Pray without ceasing.',
      ref: '1 Thessalonians 5:17 · KJV' }
  ];
  var verseOffset = 0;

  function renderVerse() {
    var day = Math.floor(new Date(todayISO + 'T12:00:00').getTime() / 86400000);
    var v = verses[(day + verseOffset) % verses.length];
    txt('verse', v.text);
    txt('verse-ref', v.ref);
  }
  on('next-verse', 'click', function () {
    verseOffset++;
    renderVerse();
  });
  renderVerse();

  var prayers = safeGet('prayers', []);

  function renderPrayers() {
    var list = el('prayers');
    clear(list);
    txt('prayer-count', '(' + prayers.length + ')');
    if (!prayers.length) {
      list.appendChild(node('li', 'muted', 'No prayer intentions yet.'));
      return;
    }
    for (var i = 0; i < prayers.length; i++) {
      var li = node('li'),
        label = node('span', '', prayers[i].text),
        b = node('button', '', '×');
      b.setAttribute('data-id', prayers[i].id);
      b.setAttribute('aria-label', 'Remove prayer');
      b.onclick = function () {
        var id = this.getAttribute('data-id'), next = [];
        for (var j = 0; j < prayers.length; j++)
          if (String(prayers[j].id) !== id) next.push(prayers[j]);
        prayers = next;
        save('prayers', prayers);
        renderPrayers();
      };
      li.appendChild(label);
      li.appendChild(b);
      list.appendChild(li);
    }
  }

  on('prayer-form', 'submit', function (e) {
    e.preventDefault();
    var v = el('prayer-input').value.replace(/^\s+|\s+$/g, '');
    if (!v) return;
    prayers.push({ id: String(new Date().getTime()), text: v });
    save('prayers', prayers);
    el('prayer-input').value = '';
    renderPrayers();
  });
  renderPrayers();

  var readings = safeGet('readings', []);

  function streak() {
    var n = 0, d = new Date(), key = iso(d);
    if (readings.indexOf(key) < 0) d.setDate(d.getDate() - 1);
    while (readings.indexOf(iso(d)) >= 0) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function renderReading() {
    var done = readings.indexOf(todayISO) >= 0;
    txt('reading-status', done
      ? 'You made time for scripture today.'
      : 'Take a few minutes to read your Bible today.');
    txt('mark-read', done ? '✓ Read today' : 'Mark today as read');
    el('mark-read').disabled = done;
    txt('reading-streak', streak() + ' day reading streak');
  }

  on('mark-read', 'click', function () {
    if (readings.indexOf(todayISO) < 0) {
      readings.push(todayISO);
      save('readings', readings);
    }
    renderReading();
  });
  renderReading();

  /* VIRTUAL DOG */
  var petName = safeGet('petName', 'Buddy'),
    asleep = false, bubbleTimer = null;

  function petLabel() {
    txt('pet-heading', petName);
    txt('pet-caption', 'Tap ' + petName + ' or choose an action.');
  }
  function speak(message) {
    txt('dog-bubble', message);
    el('dog-bubble').className = 'dog-bubble visible';
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      el('dog-bubble').className = 'dog-bubble';
    }, 2200);
  }
  function wake() {
    asleep = false;
    el('pet-walker').className = 'pet-walker';
    txt('sleep-button', '☾ Sleep');
  }
  function interact(action) {
    if (action === 'sleep') {
      asleep = !asleep;
      if (asleep) {
        el('pet-walker').className = 'pet-walker sleeping';
        txt('pet-mood', 'Sleepy and cozy');
        txt('pet-action', 'Napping');
        txt('sleep-button', '☀ Wake');
        speak('Zzz...');
      } else {
        wake();
        txt('pet-mood', 'Ready to explore');
        txt('pet-action', 'Awake');
        speak('Good morning!');
      }
      return;
    }
    wake();
    if (action === 'feed') {
      txt('pet-mood', 'Full and happy');
      txt('pet-action', 'Just ate');
      speak('Yum! 🦴');
    } else {
      txt('pet-mood', 'Feeling loved');
      txt('pet-action', 'Tail wagging');
      speak('Woof! ♡');
    }
  }

  on('pet-button', 'click', function () { interact('pet'); });
  on('feed-button', 'click', function () { interact('feed'); });
  on('sleep-button', 'click', function () { interact('sleep'); });
  on('dog', 'click', function () { interact('pet'); });
  on('dog', 'keydown', function (e) {
    if (e.keyCode === 13 || e.keyCode === 32) {
      e.preventDefault();
      interact('pet');
    }
  });
  on('rename-button', 'click', function () {
    el('rename-form').className =
      el('rename-form').className.indexOf('hidden') >= 0
        ? 'mini-form' : 'mini-form hidden';
    el('pet-name').value = petName;
  });
  on('rename-form', 'submit', function (e) {
    e.preventDefault();
    var name = el('pet-name').value.replace(/^\s+|\s+$/g, '');
    if (!name) return;
    petName = name;
    save('petName', petName);
    el('rename-form').className = 'mini-form hidden';
    petLabel();
    speak('I am ' + petName + '!');
  });
  petLabel();
})();
