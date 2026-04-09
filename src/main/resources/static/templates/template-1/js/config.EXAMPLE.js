window.WEDDING_CONFIG = {

    couple: {
        name1: "Имя 1",
        name2: "Имя 2",
        date: "YYYY-MM-DD",
        dateDisplay: "Месяц ДД, ГГГГ",
        signatureText: "Подпись молодоженов"
    },

    music: {
        enabled: true,
        url: "", // Ссылка на аудио файл
        autoplayAfterEnvelope: false
    },

    sections: {
        envelope: true,
        hero: true,
        invitation: true,
        photoStack: true,
        location: true,
        timeline: true,
        dresscode: true,
        calendar: true,
        rsvp: true
    },

    theme: {
        colors: {
            bgDark: "#1a1c18",
            bgLight: "#F9F6F0",
            primaryGreen: "#2A3A2F",
            accentGold: "#B89972",
            textMain: "#2C352D",
            textMuted: "#798075",
            white: "#ffffff"
        },
        fonts: {
            decorative: "'Great Vibes', cursive",
            main: "'Montserrat', sans-serif"
        }
    },

    images: {
        heroBackground: "images/hero-bg.jpg", // Измените на путь к реальному изображению
        gallery: [
            "images/couple-photo.jpg"
        ],
        locationPhoto: "images/restaurant.jpg"
    },

    invitation: {
        heading: "Заголовок приглашения",
        paragraphs: [
            "Текст приглашения (первый абзац).",
            "Текст приглашения (второй абзац)."
        ]
    },

    location: {
        heading: "Место торжества",
        address: "Точный адрес ресторана/локации",
        mapLink: "#",
        buttonText: "Открыть карту"
    },

    timeline: {
        heading: "Тайминг",
        events: [
            { time: "16:00", title: "Событие 1", icon: "cocktail", description: "Описание события 1" },
            { time: "17:00", title: "Событие 2", icon: "rings", description: "Описание события 2" }
        ]
    },

    dresscode: {
        heading: "Дресс-код",
        text: "Текст с описанием дресс-кода.",
        colors: ["#FFFFFF", "#000000"]
    },

    rsvp: {
        heading: "Анкета гостя",
        subtitle: "Подтвердите ваше присутствие",
        fields: {
            name: {
                label: "Ваше имя и фамилия",
                placeholder: "Введите здесь...",
                required: true
            },
            presence: {
                label: "Ваш ответ",
                yesText: "Я приду",
                yesEmoji: "🤍",
                noText: "Не смогу",
                noEmoji: "🕊️"
            },
            guestCount: {
                label: "Количество гостей",
                placeholder: "Введите здесь..."
            },
            message: {
                label: "Ваши пожелания",
                placeholder: "Напишите что-нибудь..."
            }
        },
        submitButton: "Подтвердить",
        formAction: "#", // Вставьте ссылку на Google Web App (настроенный скрипт)
        method: "POST"
    },

    options: {
        enableSecurity: false,
        enableParallax: true,
        enableSmoothScroll: true,
        animateOnScroll: true
    },
    googleScript: {
        url: "" // Вставьте ссылку на макрос для дашборда
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.WEDDING_CONFIG;
}
