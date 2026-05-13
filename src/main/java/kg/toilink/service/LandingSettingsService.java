package kg.toilink.service;

import kg.toilink.entity.LandingSettings;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.LandingSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class LandingSettingsService {

    public static final String DEFAULT_KEY = "main";

    private final LandingSettingsRepository repository;
    private final ObjectMapper objectMapper;

    public String getMainContentJson() {
        return repository.findBySettingsKey(DEFAULT_KEY)
                .map(LandingSettings::getContentJson)
                .orElseGet(this::defaultContentJson);
    }

    @Transactional
    public String updateMainContentJson(String contentJson) {
        String normalized = normalizeJson(contentJson);
        LandingSettings settings = repository.findBySettingsKey(DEFAULT_KEY)
                .orElseGet(() -> LandingSettings.builder().settingsKey(DEFAULT_KEY).build());
        settings.setContentJson(normalized);
        repository.save(settings);
        return normalized;
    }

    private String normalizeJson(String contentJson) {
        if (contentJson == null || contentJson.isBlank()) {
            throw new BadRequestException("Конфиг лендинга не может быть пустым");
        }
        try {
            JsonNode node = objectMapper.readTree(contentJson);
            if (!node.isObject()) {
                throw new BadRequestException("Конфиг лендинга должен быть JSON-объектом");
            }
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(node);
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Некорректный JSON лендинга: " + e.getMessage());
        }
    }

    public String defaultContentJson() {
        return """
                {
                  "meta": {
                    "title": "ToiLink — Красивые цифровые приглашения на той и свадьбу",
                    "description": "Создайте элегантное онлайн-приглашение на свадьбу, той, юбилей или день рождения за 5 минут. RSVP онлайн, список гостей, премиальные шаблоны.",
                    "ogTitle": "ToiLink — Цифровые приглашения за 5 минут",
                    "ogDescription": "Ссылка, RSVP и список гостей — всё в одном месте."
                  },
                  "sections": {
                    "hero": true,
                    "miniFeatures": true,
                    "phoneMockup": true,
                    "stats": true,
                    "trust": true,
                    "categories": true,
                    "how": true,
                    "features": true,
                    "comparison": true,
                    "templates": true,
                    "reviews": true,
                    "pricing": true,
                    "faq": true,
                    "finalCta": true,
                    "footer": true
                  },
                  "hero": {
                    "badge": "4.9 · 1 200+ семей в Бишкеке",
                    "titleTop": "Той вашей мечты —",
                    "titleAccent": "в одной ссылке",
                    "subtitle": "Красивое приглашение, RSVP и список гостей — за 5 минут.\\nГостям не нужно скачивать приложение или регистрироваться.",
                    "primaryCta": "Создать бесплатно",
                    "secondaryCta": "Посмотреть шаблоны",
                    "bullets": ["Без оплаты карты", "Готово за 5 минут", "Без приложений"]
                  },
                  "miniFeatures": [
                    {"title": "Отправьте\\nссылку гостям"},
                    {"title": "Узнайте кто\\nпридёт (RSVP)"},
                    {"title": "Соберите\\nсписок гостей"}
                  ],
                  "stats": {
                    "socialProof": "1 200+ пар уже выбрали\\nToiLink в этом году",
                    "items": [
                      {"value": "10K+", "label": "приглашений"},
                      {"value": "4.9", "label": "рейтинг"},
                      {"value": "320", "label": "событий"}
                    ]
                  },
                  "trust": ["1 200+ свадеб в Бишкеке", "Поддержка 24/7", "Без водяного знака", "Mbank · O!Dengi · Visa", "RSVP в реальном времени", "Экспорт в Excel", "12 премиум-шаблонов"],
                  "categories": {
                    "eyebrow": "Для любого события",
                    "title": "Шаблоны для каждого праздника",
                    "items": [
                      {"emoji": "💍", "title": "Свадьба", "text": "Элегантные дизайны для особого дня"},
                      {"emoji": "🎊", "title": "Той", "text": "Для большого праздника с сотнями гостей"},
                      {"emoji": "🎂", "title": "День рождения", "text": "Яркие и нежные темы в вашем стиле"},
                      {"emoji": "🏅", "title": "Юбилей", "text": "Торжественное приглашение для юбиляра"},
                      {"emoji": "🌸", "title": "Узатуу", "text": "Нежные шаблоны в традиционном стиле"},
                      {"emoji": "🏢", "title": "Корпоратив", "text": "Официально, чётко и стильно"}
                    ]
                  },
                  "how": {
                    "eyebrow": "Процесс",
                    "title": "Три шага к идеальному событию",
                    "subtitle": "Создайте приглашение за 5 минут и забудьте о бумажной рутине.",
                    "cta": "Создать приглашение",
                    "steps": [
                      {"title": "Создайте", "text": "Выберите шаблон, добавьте фото и детали события. Конструктор простой и понятный."},
                      {"title": "Отправьте", "text": "Скопируйте ссылку и отправьте гостям в WhatsApp или Telegram. Без приложений."},
                      {"title": "Следите", "text": "Ответы гостей приходят мгновенно. Скачайте готовый список в Excel перед банкетом."}
                    ]
                  },
                  "features": {
                    "eyebrow": "Почему ToiLink",
                    "title": "Меньше хлопот — больше праздника",
                    "subtitle": "Забудьте про ручной обзвон, бумажные открытки и Excel-таблицы. Всё уже сделано за вас.",
                    "items": [
                      {"title": "Не повторитесь", "text": "12 уникальных дизайнов. Ваше приглашение точно никто не пришлёт повторно."},
                      {"title": "Точное число гостей", "text": "Не считаете «плюс-минус» в WhatsApp — за неделю до тоя вы знаете точно."},
                      {"title": "Никого не забыть", "text": "Все гости в одном списке: кто +1, кто едет, кто отказался. Без бумажек."},
                      {"title": "Одна ссылка для всех", "text": "Отправляете в WhatsApp — гость открывает и сразу видит красивое приглашение."},
                      {"title": "Узнаёте мгновенно", "text": "Не нужно ждать обзвона. Каждый ответ прилетает сразу — как сообщение."},
                      {"title": "Готово для тамады", "text": "Excel со списком гостей для рассадки — в один клик. Тамада скажет «спасибо»."}
                    ],
                    "highlightTitle": "Работает прямо в браузере",
                    "highlightText": "Гостям не нужно скачивать приложение, регистрироваться или запоминать логины. Открыли ссылку — увидели красивое приглашение. На любом телефоне, в любом мессенджере.",
                    "highlightCta": "Попробовать"
                  },
                  "comparison": {
                    "eyebrow": "Сравнение",
                    "title": "Почему не WhatsApp",
                    "subtitle": "Не считайте гостей вручную. Не теряйте кто +1, кто едет, кто отказался.",
                    "cta": "Создать в ToiLink за 5 минут"
                  },
                  "templates": {
                    "eyebrow": "Галерея",
                    "title": "Наши шаблоны",
                    "subtitle": "Выберите стиль для вашего события",
                    "cta": "Смотреть все 12 шаблонов"
                  },
                  "reviews": {
                    "eyebrow": "Отзывы",
                    "title": "Что говорят пары",
                    "items": [
                      {"text": "Сделала приглашение за вечер — получилось красивее, чем у свадебного дизайнера. Все родственники были в восторге, а я экономнула кучу денег на печати.", "name": "Айгуль Сатарова", "meta": "Свадьба · 320 гостей", "avatar": "А"},
                      {"text": "Не надо обзванивать 200 человек — все сами отметились кто идёт, кто нет. Организатор банкета был в восторге: точное число за неделю до тоя.", "name": "Нурланбек Омуралиев", "meta": "Той · 450 гостей", "avatar": "Н"},
                      {"text": "Думала будет сложно — оказалось проще чем сторис в Instagram. 15 минут и ссылка готова. Бабушке показала — она тоже всё поняла и нажала «приду».", "name": "Бермет Асанова", "meta": "Юбилей мамы · 120 гостей", "avatar": "Б"}
                    ]
                  },
                  "pricing": {
                    "eyebrow": "Тарифы",
                    "title": "Простые и честные цены",
                    "subtitle": "Начните бесплатно. Премиум — один раз для одного события, без подписок.",
                    "plans": [
                      {"name": "Старт", "tag": "бесплатно", "description": "Попробовать без риска", "price": "0", "currency": "сом", "note": "навсегда · без карты", "cta": "Начать бесплатно", "features": ["До 50 гостей", "RSVP-кнопки и список гостей", "3 базовых шаблона", "Маленький логотип ToiLink"]},
                      {"name": "Премиум", "tag": "для тоя", "description": "Идеально для большого события", "price": "990", "currency": "сом", "oldPrice": "1 990", "note": "разово за всё событие · скидка 50%", "badge": "★ выбирают 87%", "cta": "Создать приглашение", "features": ["Гостей — без ограничений", "Все 12 премиум-шаблонов", "Без водяного знака", "Экспорт списка гостей в Excel", "Уведомления о новых RSVP", "Поддержка 24/7 в WhatsApp"]}
                    ],
                    "badges": ["Гарантия возврата 7 дней", "Доступ — мгновенно", "Поддержка на русском и кыргызском"]
                  },
                  "faq": {
                    "eyebrow": "FAQ",
                    "title": "Частые вопросы",
                    "items": [
                      {"question": "Нужно ли гостям скачивать приложение?", "answer": "Нет. Гость получает ссылку, открывает её в браузере и видит красивое приглашение. Никаких скачиваний, регистраций и лишних шагов."},
                      {"question": "Как гости подтверждают участие?", "answer": "На странице приглашения есть кнопки «Буду» и «Не смогу». Гость нажимает, и вы сразу видите ответ в личном кабинете. Можно также указать количество сопровождающих."},
                      {"question": "Можно ли изменить приглашение после публикации?", "answer": "Да. Вы можете редактировать текст, дату и место в любое время. Все уже отправленные ссылки автоматически покажут обновлённую информацию — ссылку заново рассылать не нужно."},
                      {"question": "Сколько гостей можно добавить?", "answer": "На бесплатном тарифе — до 50 гостей. На Премиум — неограниченно. Для большого тоя рекомендуем Премиум — там нет ограничений."},
                      {"question": "Как выглядит ссылка для гостей?", "answer": "Ссылка выглядит красиво: toilink.kg/e/айбек-айгуль. При отправке в WhatsApp или Telegram автоматически показывается превью-карточка с деталями события."},
                      {"question": "Как оплатить Премиум?", "answer": "Оплата через Mbank, O!Dengi, банковскую карту или перевод. Доступ открывается моментально после подтверждения платежа."}
                    ]
                  },
                  "finalCta": {
                    "badge": "+12 пар выбрали ToiLink сегодня",
                    "title": "Ваш той заслуживает красивого приглашения",
                    "subtitle": "Сделайте первое приглашение бесплатно прямо сейчас.\\nБез оплаты карты — посмотрите как получится, потом решите.",
                    "primaryCta": "Создать бесплатно",
                    "secondaryCta": "Посмотреть тарифы",
                    "bullets": ["Без оплаты карты", "Готово за 5 минут", "Гарантия возврата 7 дней"]
                  },
                  "footer": {
                    "text": "Цифровые приглашения для особых моментов вашей жизни — свадьба, той, юбилей, день рождения.",
                    "phone": "+996 700 000 000",
                    "email": "hello@toilink.kg",
                    "city": "Бишкек, Кыргызстан",
                    "copyright": "© 2026 ToiLink. Все права защищены."
                  }
                }
                """;
    }
}
