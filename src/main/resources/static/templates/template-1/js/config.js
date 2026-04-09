

window.WEDDING_CONFIG = {


  couple: {
    name1: "Улансын",
    name2: "Эльнура",
    date: "2026-10-13",
    dateDisplay: "Октябрь 13, 2026",
    signatureText: "С любовью, Улансын и Эльнура"
  },


  music: {
    enabled: true,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Ссылка на аудио
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
    heroBackground: "images/hero-bg2.jpg",
    gallery: [
      "images/couple-photo.jpg",
      "images/hero-bg.jpg"
    ],
    locationPhoto: "images/restaurant.jpg"
  },


  invitation: {
    heading: "Дорогие гости!",
    paragraphs: [
      "Мы рады пригласить вас разделить с нами один из самых счастливых дней в нашей жизни — нашу свадьбу! Мы стремились создать неповторимую атмосферу, и ваше присутствие сделает этот день по‑настоящему волшебным. С нетерпением ждём встречи и уверены, что вместе мы создадим праздник, который запомнится на всю жизнь!"
    ]
  },


  location: {
    heading: "Место",
    address: "Загородный клуб 'Ривьера', Московская область, 25 км от МКАД",
    mapLink: "https://2gis.kg/search/Загородный%20клуб%20Ривьера",
    buttonText: "Открыть карту"
  },


  timeline: {
    heading: "Тайминг",
    events: [
      { time: "16:00", title: "Сбор гостей", icon: "cocktail", description: "Приветственный фуршет и живая музыка" },
      { time: "17:00", title: "Церемония", icon: "rings", description: "Трогательный момент обмена клятвами" },
      { time: "18:00", title: "Банкет", icon: "dinner", description: "Ужин, тосты и развлекательная программа" },
      { time: "22:00", title: "Торт", icon: "cake", description: "Сладкое завершение вечера" }
    ]
  },




  dresscode: {
    heading: "Дресс-код",
    text: "Для того чтобы этот день стал поистине незабываемым, мы хотели бы попросить вас придерживаться выбранного дресс-кода. Ваш стильный выбор поможет создать атмосферу волшебства и праздничности, которой мы так ждём.",
    colors: ["#FFFFFF", "#976803ff", "#b33030ff", "#689d34ff"]
  },


  rsvp: {
    heading: "Анкета гостя",
    subtitle: "Пожалуйста, подтвердите ваше присутствие",
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
        placeholder: "Напишите нам что-нибудь..."
      }
    },
    submitButton: "Подтвердить",
    formAction: "#",
    method: "POST"
  },


  options: {
    enableSecurity: false, // Включить/выключить защиту от копирования
    enableParallax: true,
    enableSmoothScroll: true,
    animateOnScroll: true
  },
  googleScript: {
    url: "https://script.google.com/macros/s/AKfycbwzD7Y7yXDUU-PNRuoVwWm6LnpVyR3H6YK4HvaGAcaONgCtbyh7-m-6nQpg4LaVzNrL/exec"
  }
};


if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.WEDDING_CONFIG;
}