import { useSyncExternalStore } from "react";

/**
 * Interface language. Azerbaijani text is the key; English and Russian come from the tables below and fall back to
 * Azerbaijani, so an untranslated string never breaks a page. Data from official sources (plot names, villages,
 * statistics) is kept in Azerbaijani, as published.
 */
export type Lang = "az" | "en" | "ru";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "az", label: "AZ" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

const KEY = "aqrar-lang";
let current: Lang = read();
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "ru" || v === "az") return v;
  } catch { /* storage unavailable */ }
  return "az";
}

export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function getLang() {
  return current;
}

export function translate(text: string, lang: Lang = current): string {
  if (lang === "az") return text;
  return DICT[text]?.[lang === "en" ? 0 : 1] ?? text;
}

/** Hook: re-renders on language change and returns t(). */
export function useT() {
  const lang = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
  const t = (text: string, vars?: Record<string, string | number>) => {
    let s = translate(text, lang);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  return { t, lang };
}

if (typeof document !== "undefined") document.documentElement.lang = current;

// [English, Russian]
const DICT: Record<string, [string, string]> = {
  // header, navigation, footer
  "Xəritə": ["Map", "Карта"],
  "3D xəritə": ["3D map", "3D-карта"],
  "Kataloq": ["Catalogue", "Каталог"],
  "Müsabiqələr": ["Tenders", "Конкурсы"],
  "Məsləhətçi": ["Advisor", "Советник"],
  "Şəffaflıq": ["Transparency", "Прозрачность"],
  "İnvestisiya müsabiqəsi portalı": ["Investment tender portal", "Портал инвестиционных конкурсов"],
  "Prototip: EKTİS-ə inteqrasiya üçün hazırlanıb": ["Prototype built for integration with EKTIS", "Прототип для интеграции с EKTİS"],
  "Axtarış": ["Search", "Поиск"],
  "Qəbzi yoxla": ["Verify receipt", "Проверить квитанцию"],
  "Açıq API": ["Open API", "Открытый API"],
  "Əsas menyu": ["Main menu", "Главное меню"],
  "İnzibati panel": ["Admin panel", "Панель администратора"],
  "Kabinetim": ["My account", "Мой кабинет"],
  "Çıxış": ["Sign out", "Выход"],
  "Qeydiyyat": ["Register", "Регистрация"],
  "Daxil ol": ["Sign in", "Войти"],
  "Menyu": ["Menu", "Меню"],
  "Bildirişlər": ["Notifications", "Уведомления"],
  "Bildiriş yoxdur": ["No notifications", "Нет уведомлений"],
  "Yüklənir…": ["Loading…", "Загрузка…"],
  "Yüklənir": ["Loading", "Загрузка"],
  "Əsas məzmuna keç": ["Skip to main content", "Перейти к содержимому"],
  "Dil": ["Language", "Язык"],
  "İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı torpaqlarına investisiya müsabiqəsinin rəqəmsal platforması. Prototip, hakaton layihəsi.":
    ["Digital platform for investment tenders on agricultural land in the liberated territories. Prototype, hackathon project.",
      "Цифровая платформа инвестиционных конкурсов на сельхозземли освобождённых территорий. Прототип, хакатон-проект."],
  "İnvestorlar üçün": ["For investors", "Инвесторам"],
  "Aqrar investisiya xəritəsi": ["Agricultural investment map", "Карта аграрных инвестиций"],
  "İmkanlar kataloqu": ["Opportunities catalogue", "Каталог возможностей"],
  "AI məsləhətçi": ["AI advisor", "ИИ-советник"],
  "Açıq statistika": ["Open statistics", "Открытая статистика"],
  "API sənədləri": ["API documentation", "Документация API"],
  "Məlumat mənbələri": ["Data sources", "Источники данных"],
  "Platforma": ["Platform", "Платформа"],
  "Daxil ol / Qeydiyyat": ["Sign in / Register", "Вход / Регистрация"],
  "Şəxsi kabinet": ["Personal account", "Личный кабинет"],
  "Aqrar İnvest prototipi. Məlumatlar nümayiş məqsədlidir.": ["Aqrar Invest prototype. Data shown for demonstration.", "Прототип «Аграр Инвест». Данные демонстрационные."],
  "Fotolar: Wikimedia Commons (CC BY / CC BY-SA)": ["Photos: Wikimedia Commons (CC BY / CC BY-SA)", "Фото: Wikimedia Commons (CC BY / CC BY-SA)"],

  "Portal köməkçisi": ["Portal assistant", "Помощник портала"],
  "Köməkçi": ["Assistant", "Помощник"],

  // install as app
  "Tətbiq kimi quraşdır": ["Install as an app", "Установить как приложение"],
  "Telefonun ana ekranına əlavə edin": ["Add it to your home screen", "Добавьте на главный экран"],
  "Əlavə et": ["Add", "Добавить"],
  "Sonra": ["Later", "Позже"],
  "Ana ekrana əlavə et": ["Add to home screen", "Добавить на главный экран"],
  "Safari-nin aşağı panelində «Paylaş» düyməsinə toxunun": ["In Safari, tap the Share button in the bottom bar", "В Safari нажмите кнопку «Поделиться» внизу"],
  "«Ana ekrana əlavə et» (Add to Home Screen) seçin, sonra «Əlavə et»": ["Choose “Add to Home Screen”, then “Add”", "Выберите «На экран Домой», затем «Добавить»"],
  "Brauzerin menyusunu açın (yuxarı sağda)": ["Open the browser menu (top right)", "Откройте меню браузера (вверху справа)"],
  "«Ana ekrana əlavə et» və ya «Tətbiqi quraşdır» seçin": ["Choose “Add to Home screen” or “Install app”", "Выберите «Добавить на главный экран» или «Установить приложение»"],
  "Aydındır": ["Got it", "Понятно"],

  // landing
  "Portal": ["Portal", "Портал"],
  "Sahəni tap": ["Find a plot", "Найти участок"],
  "Qarabağın torpağı yenidən": ["Karabakh land is ready", "Земля Карабаха снова"],
  "əkinə hazırdır": ["to farm again", "готова к посеву"],
  "Minadan təmizlənmiş sahələri tapın, süni intellektlə yoxlayın, investisiya müsabiqəsinə onlayn müraciət edin.": ["Find demined plots, check them with AI and apply to the investment tender online.", "Найдите разминированные участки, проверьте их с помощью ИИ и подайте заявку на инвестиционный конкурс онлайн."],

  // home
  "Ana səhifə": ["Home", "Главная"],
  "Qarabağ iqtisadi rayonu": ["Karabakh economic region", "Карабахский экономический район"],
  "Kənd təsərrüfatı torpaqlarına investisiya müsabiqəsi": ["Investment tender for agricultural land", "Инвестиционный конкурс на сельскохозяйственные земли"],
  "Sahə üzrə axtarış:": ["Search for a plot:", "Поиск участка:"],
  "Kənd, rayon və ya sahə kodu": ["Village, district or plot code", "Село, район или код участка"],
  "Məsələn,": ["For example,", "Например,"],
  "Müsabiqə elanları": ["Tender announcements", "Объявления о конкурсах"],
  "Bütün elanlar": ["All announcements", "Все объявления"],
  "sahə": ["plots", "участков"],
  "son müraciət tarixi": ["application deadline", "срок подачи"],
  "{n} gün qalıb": ["{n} days left", "осталось {n} дн."],
  "Əsas göstəricilər": ["Key figures", "Основные показатели"],
  "Ətraflı": ["Details", "Подробнее"],
  "Təklif olunan sahələr": ["Plots offered", "Предлагаемые участки"],
  "Ümumi ərazi": ["Total area", "Общая площадь"],
  "Minadan təmizlənmiş sahələr": ["Demined plots", "Разминированные участки"],
  "Açıq müsabiqələr": ["Open tenders", "Открытые конкурсы"],
  "Daxil olan müraciətlər": ["Applications received", "Поступившие заявки"],
  "Planlaşdırılan investisiya": ["Planned investment", "Планируемые инвестиции"],
  "Yaradılacaq iş yerləri": ["Jobs to be created", "Создаваемые рабочие места"],
  "Onlardan qayıdan sakinlər üçün": ["Of which for returning residents", "Из них для возвращающихся жителей"],
  "Elektron xidmətlər": ["E-services", "Электронные услуги"],
  "Sahə axtarışı": ["Plot search", "Поиск участков"],
  "Müsabiqəyə çıxarılan torpaq sahələri": ["Land plots offered in tenders", "Земельные участки на конкурсе"],
  "İnvestisiya xəritəsi": ["Investment map", "Инвестиционная карта"],
  "Sahələr xəritədə, peyk görüntüsü ilə": ["Plots on the map with satellite imagery", "Участки на карте со спутниковыми снимками"],
  "Elektron müraciət": ["Online application", "Электронная заявка"],
  "Müraciət və statusun izlənməsi": ["Apply and track status", "Подача и отслеживание статуса"],
  "Qəbzin yoxlanması": ["Receipt verification", "Проверка квитанции"],
  "Müraciət qəbzinin həqiqiliyi": ["Check an application receipt", "Подлинность квитанции заявки"],
  "Bitki məsləhətçisi": ["Crop advisor", "Советник по культурам"],
  "Torpağa uyğun bitki tövsiyəsi": ["Crop recommendation for the soil", "Рекомендация культур по почве"],
  "Müsabiqələrin gedişi və qərarlar": ["Tender progress and decisions", "Ход конкурсов и решения"],
  "Fəaliyyət istiqamətləri üzrə sahələr": ["Plots by activity", "Участки по направлениям"],
  "Bu istiqamət üzrə sahə yoxdur.": ["No plots for this activity.", "По этому направлению участков нет."],
  "İnteqrasiya olunan dövlət sistemləri": ["Integrated government systems", "Интегрированные госсистемы"],
  "Prototipdə simulyasiya ilə nümayiş etdirilir": ["Simulated in the prototype", "В прототипе показаны в режиме симуляции"],
  "Elektron Kənd Təsərrüfatı İnformasiya Sistemi: müraciətlər və fermer reyestri": ["Electronic Agriculture Information System: applications and farmer registry", "Электронная информационная система сельского хозяйства: заявки и реестр фермеров"],
  "Dövlət identifikasiyası ilə giriş (OAuth 2.0)": ["Sign-in with government ID (OAuth 2.0)", "Вход через госидентификацию (OAuth 2.0)"],
  "Minatəmizləmə məlumatları": ["Demining data", "Данные о разминировании"],
  "Sahələrin minadan təmizlənmə statusu və tarixi": ["Demining status and date of each plot", "Статус и дата разминирования участков"],
  "Kod": ["Code", "Код"],
  "Sahə": ["Plot", "Участок"],
  "Rayon": ["District", "Район"],
  "Ərazi": ["Area", "Площадь"],
  "Min. investisiya": ["Min. investment", "Мин. инвестиции"],
  "Status": ["Status", "Статус"],
  "Müsabiqədə deyil": ["Not in a tender", "Не на конкурсе"],
  "Yanvar": ["January", "Января"], "Fevral": ["February", "Февраля"], "Mart": ["March", "Марта"], "Aprel": ["April", "Апреля"],
  "May": ["May", "Мая"], "İyun": ["June", "Июня"], "İyul": ["July", "Июля"], "Avqust": ["August", "Августа"],
  "Sentyabr": ["September", "Сентября"], "Oktyabr": ["October", "Октября"], "Noyabr": ["November", "Ноября"], "Dekabr": ["December", "Декабря"],

  // catalogue, plot cards, filters
  "İnvestisiya imkanları kataloqu": ["Investment opportunities catalogue", "Каталог инвестиционных возможностей"],
  "Müsabiqəyə çıxarılan sahələr: ölçü, yerləşmə, istifadə şərtləri, minadan təmizlənmə statusu və son müraciət tarixi. 2–4 sahəni seçib yan-yana müqayisə edin.":
    ["Plots offered in tenders: size, location, terms of use, demining status and application deadline. Pick 2–4 plots to compare side by side.",
      "Участки на конкурсе: размер, расположение, условия, статус разминирования и срок подачи. Выберите 2–4 участка для сравнения."],
  "Xəritə görünüşü": ["Map view", "На карте"],
  "{n} sahə tapıldı": ["{n} plots found", "Найдено участков: {n}"],
  "Filtrləri sıfırla": ["Reset filters", "Сбросить фильтры"],
  "Filtrə uyğun sahə tapılmadı": ["No plots match the filters", "Нет участков по фильтрам"],
  "Filtrləri dəyişin və ya sıfırlayın.": ["Change or reset the filters.", "Измените или сбросьте фильтры."],
  "Ən çox 4 sahə müqayisə etmək olar": ["You can compare up to 4 plots", "Можно сравнить не более 4 участков"],
  "Müqayisə": ["Compare", "Сравнить"],
  "Müqayisə et": ["Compare", "Сравнить"],
  "Təmizlə": ["Clear", "Очистить"],
  "{n} sahə seçilib": ["{n} selected", "Выбрано: {n}"],
  " · ən azı 2": [" · at least 2", " · минимум 2"],
  "rayonu": ["district", "район"],
  "Suya qədər": ["To water", "До воды"],
  "Torpağa ən uyğun bitki:": ["Best crop for the soil:", "Лучшая культура для почвы:"],
  "Son müraciət:": ["Deadline:", "Срок подачи:"],
  "Fəaliyyət istiqaməti": ["Activity", "Направление"],
  "Hamısı": ["All", "Все"],
  "Minadan təmizlənmə": ["Demining", "Разминирование"],
  "AI tövsiyə etdiyi bitki": ["AI-recommended crop", "Культура по рекомендации ИИ"],
  "Sahə, hektar": ["Area, hectares", "Площадь, га"],
  "Sıralama": ["Sort", "Сортировка"],
  "Koda görə": ["By code", "По коду"],
  "Son tarix yaxın": ["Deadline soonest", "Ближайший срок"],
  "Sahə: böyükdən": ["Area: largest first", "Площадь: по убыванию"],
  "Sahə: kiçikdən": ["Area: smallest first", "Площадь: по возрастанию"],
  "Min. investisiya: azdan": ["Min. investment: lowest first", "Мин. инвестиции: по возрастанию"],
  "Yalnız açıq müsabiqədə olanlar": ["Open tenders only", "Только открытые конкурсы"],
  "Kənd, rayon, sahə kodu…": ["Village, district, plot code…", "Село, район, код участка…"],

  // plot page, 3D map, satellite
  "3D bax": ["View in 3D", "Смотреть в 3D"],
  "Xəritədə": ["On the map", "На карте"],
  "İcarə müddəti": ["Lease term", "Срок аренды"],
  "Müraciətlər": ["Applications", "Заявки"],
  "il": ["yrs", "лет"],
  "Müraciət et": ["Apply", "Подать заявку"],
  "Daxil olub müraciət et": ["Sign in to apply", "Войдите, чтобы подать заявку"],
  "3D investisiya xəritəsi": ["3D investment map", "3D-карта инвестиций"],
  "Relyef, peyk görüntüsü və ANAMA-nın rəsmi sərhədləri. Sahəni seçin, kamera ona uçacaq.":
    ["Terrain, satellite imagery and official ANAMA boundaries. Pick a plot and the camera flies to it.",
      "Рельеф, спутниковые снимки и официальные границы ANAMA. Выберите участок — камера подлетит к нему."],
  "Fırlanmanı dayandır": ["Stop rotation", "Остановить вращение"],
  "Fırlat": ["Rotate", "Вращать"],
  "Ümumi görünüş": ["Overview", "Общий вид"],
  "2D xəritə": ["2D map", "2D-карта"],
  "Rayon, kənd": ["District, village", "Район, село"],
  "Təyinat": ["Purpose", "Назначение"],
  "AI tövsiyəsi": ["AI recommendation", "Рекомендация ИИ"],
  "Bağla": ["Close", "Закрыть"],
  "Peyk monitorinqi (NDVI)": ["Satellite monitoring (NDVI)", "Спутниковый мониторинг (NDVI)"],
  "Sentinel-2, son 13 ay": ["Sentinel-2, last 13 months", "Sentinel-2, последние 13 мес."],
  "Peyk görüntüləri təhlil edilir": ["Analysing satellite images", "Анализ спутниковых снимков"],
  "Təbii rənglər": ["True colour", "Естественные цвета"],
  "boş → yaşıl": ["bare → green", "голая почва → зелень"],

  // plot page tabs
  "Ümumi": ["Overview", "Обзор"],
  "Torpaq və AI": ["Soil & AI", "Почва и ИИ"],
  "Gəlir kalkulyatoru": ["Income calculator", "Калькулятор дохода"],
  "Peyk monitorinqi": ["Satellite monitoring", "Спутниковый мониторинг"],
  "Rəsmi statistika": ["Official statistics", "Официальная статистика"],
  "Ən uyğun bitki (AI)": ["Best crop (AI)", "Лучшая культура (ИИ)"],
  "Günəş paneli": ["Solar panels", "Солнечные панели"],
  "İnfrastruktur": ["Infrastructure", "Инфраструктура"],

  // solar
  "Günəş enerjisi": ["Solar energy", "Солнечная энергия"],
  "Tarif Şurası": ["Tariff Council", "Тарифный совет"],
  "Günəş potensialı hesablanır": ["Calculating solar potential", "Расчёт солнечного потенциала"],
  "ildə": ["per year", "в год"],
  "radiasiya": ["irradiation", "инсоляция"],
  "optimal bucaq": ["optimal tilt", "оптимальный угол"],
  "Aylıq istehsal": ["Monthly output", "Месячная выработка"],
  "İstehsal": ["Output", "Выработка"],
  "Aktiv istehlakçı (≤150 kW)": ["Active consumer (≤150 kW)", "Активный потребитель (≤150 кВт)"],
  "Aqrovoltaik stansiya": ["Agrivoltaic plant", "Агровольтаическая станция"],
  "Qurğunun gücü": ["System size", "Мощность установки"],
  "Panellərin örtdüyü hissə": ["Share covered by panels", "Доля под панелями"],
  "Quraşdırma xərci, ₼/kWp": ["Installed cost, ₼/kWp", "Стоимость монтажа, ₼/кВт"],
  "Güc": ["Capacity", "Мощность"],
  "İllik istehsal": ["Annual output", "Годовая выработка"],
  "İlkin investisiya": ["Initial investment", "Первоначальные инвестиции"],
  "İllik gəlir və qənaət": ["Annual revenue and savings", "Годовой доход и экономия"],
  "İstismar xərci": ["O&M cost", "Эксплуатационные расходы"],
  "Geri qaytarılma": ["Payback", "Окупаемость"],
  "{n}-ci il": ["year {n}", "{n}-й год"],
  "25 ildə qaytarılmır": ["No payback in 25 years", "Не окупается за 25 лет"],
  "25 ildə xalis nəticə": ["Net result over 25 years", "Чистый результат за 25 лет"],
  "CO₂ azalması": ["CO₂ reduction", "Снижение CO₂"],
  "ton/il": ["t/yr", "т/год"],
  "Sahənin illik gəlirinə təsiri": ["Effect on the plot's annual income", "Влияние на годовой доход участка"],
  "Kənd təsərrüfatı (xalis)": ["Farming (net)", "Сельское хозяйство (чистый)"],
  "Günəş enerjisi (xalis)": ["Solar (net)", "Солнечная энергия (чистый)"],
  "Cəmi": ["Total", "Итого"],
  "Günəş enerjisi sahənin illik xalis gəlirini {p}% artırır.": ["Solar raises the plot's annual net income by {p}%.", "Солнечная энергия увеличивает годовой чистый доход участка на {p}%."],
  "Günəş enerjisi sahəyə sabit, mövsümdən asılı olmayan gəlir əlavə edir.": ["Solar adds steady, non-seasonal income to the plot.", "Солнечная энергия даёт стабильный внесезонный доход."],
  "Mənbələr": ["Sources", "Источники"],
  "Günəş paneli üçün yüksək uyğunluq": ["Highly suitable for solar panels", "Высокая пригодность для солнечных панелей"],
  "Günəş paneli üçün uyğundur": ["Suitable for solar panels", "Подходит для солнечных панелей"],
  "Uyğunluq məhduddur": ["Limited suitability", "Ограниченная пригодность"],
  "Hazırda uyğun deyil: minatəmizləmə başa çatmayıb": ["Not suitable yet: demining not finished", "Пока не подходит: разминирование не завершено"],
  "Günəş potensialı": ["Solar potential", "Солнечный потенциал"],
  "Minatəmizləmə": ["Demining", "Разминирование"],
  "Şəbəkəyə qoşulma": ["Grid connection", "Подключение к сети"],
  "Fəaliyyətlə uyğunluq": ["Fit with farming", "Совместимость с деятельностью"],

  // backend labels shown as-is from the API
  "Əkinçilik": ["Crop farming", "Растениеводство"],
  "Heyvandarlıq": ["Livestock", "Животноводство"],
  "Bağçılıq": ["Orchards", "Садоводство"],
  "Üzümçülük": ["Viticulture", "Виноградарство"],
  "İstixana təsərrüfatı": ["Greenhouses", "Тепличное хозяйство"],
  "Arıçılıq": ["Beekeeping", "Пчеловодство"],
  "Minadan təmizlənib": ["Demined", "Разминировано"],
  "Təmizlənmə davam edir": ["Demining in progress", "Идёт разминирование"],
  "Təmizlənmə planlaşdırılıb": ["Demining planned", "Разминирование запланировано"],
  "Sərbəst": ["Available", "Свободен"],
  "Müsabiqədə": ["In tender", "На конкурсе"],
  "Təhvil verilib": ["Assigned", "Передан"],
  "Alma": ["Apple", "Яблоня"], "Düyü": ["Rice", "Рис"], "Lobya": ["Kidney bean", "Фасоль"], "Maş": ["Mung bean", "Маш"],
  "Mərcimək": ["Lentil", "Чечевица"], "Nar": ["Pomegranate", "Гранат"], "Noxud": ["Chickpea", "Нут"], "Pambıq": ["Cotton", "Хлопок"],
  "Qarpız": ["Watermelon", "Арбуз"], "Qarğıdalı": ["Maize", "Кукуруза"], "Yemiş": ["Melon", "Дыня"], "Üzüm": ["Grapes", "Виноград"],
};
