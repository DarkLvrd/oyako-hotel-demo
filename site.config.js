/* ============================================================================
 * Oyako Hotel — the one settings file.
 *
 * Everything a pitch needs to re-badge lives here: name, legal name, logo,
 * colours, fonts, contact details, WhatsApp number, the room ladder with its
 * prices and inventory, the facilities, the gallery, the reviews and the
 * location. No other file needs editing to re-brand this site.
 *
 * The page is plain classic scripts, not modules, so it opens by double-click
 * from the filesystem — see README.md for the re-badge checklist.
 * ==========================================================================*/
(function () {
  'use strict';

  window.OYAKO = {
    /* ---------------------------------------------------------------- meta */
    meta: {
      title: 'Oyako Hotel — Maitama, Abuja',
      description:
        'Ninety-four rooms and suites in the heart of the capital. A city hotel of ' +
        'quiet, daylit luxury in Maitama, Abuja.',
      // Shown in the booking panel and the footer. Nothing here is real.
      demoNotice:
        'Demonstration website. Prices, availability and reviews are illustrative, ' +
        'no reservation is made and no payment is taken.',
    },

    /* --------------------------------------------------------------- brand */
    brand: {
      // The brand shown in the header and headlines.
      name: 'Oyako Hotel',
      wordmark: 'OYAKO',
      wordmarkSub: 'HOTEL · ABUJA',
      // The registered name, for footer and legal lines only.
      legalName: 'Oyako Hotel Limited',
      cityLine: 'Maitama · Abuja',
      // Re-badge the logo by replacing this markup. Any inline SVG works; it
      // inherits currentColor and is sized by CSS.
      markSvg:
        '<svg viewBox="0 0 44 44" width="100%" height="100%" fill="none" aria-hidden="true">' +
        '<circle cx="22" cy="22" r="20.5" stroke="currentColor" stroke-width="1"/>' +
        '<path d="M22 30.5c-5.2 0-9.4-3-9.4-8.4 0-5.4 4.2-8.6 9.4-8.6s9.4 3.2 9.4 8.6c0 5.4-4.2 8.4-9.4 8.4Z" stroke="currentColor" stroke-width="1"/>' +
        '<path d="M22 27.6c-3.3 0-6-1.9-6-5.5s2.7-5.7 6-5.7 6 2.1 6 5.7-2.7 5.5-6 5.5Z" stroke="currentColor" stroke-width="1"/>' +
        '<path d="M22 13.4V8.6M12.6 30.6l-4 3.4M31.4 30.6l4 3.4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
        '</svg>',
    },

    /* --------------------------------------------------------------- theme */
    // Direction B — "Ivory Champagne". Fonts are pairing 1, Libre Baskerville
    // + Inter, both SIL Open Font License and bundled in assets/fonts/.
    theme: {
      paper: '#FAF8F4',
      paperAlt: '#F3EFE7',
      ink: '#1E1B17',
      inkSoft: '#5E574C',
      inkMuted: '#8A8172',
      accent: '#9C7B4A',
      rule: '#E6DFD3',
      ok: '#2F6B4F',
      okBg: '#EFF4F0',
      okBd: '#C9D8CE',
      low: '#8A5A16',
      lowBg: '#FBF3E4',
      lowBd: '#E7D6B6',
      out: '#7A736A',
      outBg: '#F2EFEA',
      outBd: '#E0DAD0',
      fontDisplay: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
      fontSans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    },

    /* ------------------------------------------------------------- contact */
    contact: {
      // Placeholder. Digits only, with the country code and no plus sign.
      whatsapp: '2348012345678',
      whatsappLabel: 'Chat to book',
      whatsappMessage:
        'Hello Oyako Hotel. I would like to ask about staying with you.',
      phone: '+234 9 461 2345',
      email: 'reservations@oyakohotel.example',
      addressLines: ['1 Oyako Close, Maitama', 'Abuja 900271, Nigeria'],
      directionsUrl:
        'https://www.google.com/maps/search/?api=1&query=Maitama%2C+Abuja%2C+Nigeria',
      reception: 'Reception and concierge, 24 hours',
    },

    /* ------------------------------------------------------------- booking */
    booking: {
      // Fixed defaults keep the demo stable between reloads; if they have gone
      // stale they roll forward to today + leadDays.
      defaultCheckIn: '2026-11-14',
      defaultCheckOut: '2026-11-17',
      leadDays: 14,
      maxNights: 21,
      guestOptions: [
        { value: 1, label: '1 Adult' },
        { value: 2, label: '2 Adults' },
        { value: 3, label: '3 Adults' },
        { value: 4, label: '4 Adults' },
        { value: 5, label: '4 Adults, 1 Child' },
        { value: 6, label: '4 Adults, 2 Children' },
      ],
      defaultGuests: 2,
      footnote:
        'Rates are per room, per night, in US dollars, and include taxes and Wi-Fi. ' +
        'Nothing is charged on this site.',
    },

    /* ---------------------------------------------------------------- hero */
    hero: {
      eyebrow: 'Oyako Hotel · Abuja',
      // <em> is the accented word; it renders in the brand accent colour.
      headline: 'Quiet luxury <em>under Aso Rock</em>',
      lede:
        'Ninety-four rooms and suites above the rooftops of Maitama, dressed in linen, ' +
        'travertine and light. A house that stays out of the way of your stay.',
      image: 'assets/img/lobby.jpg',
      imageAlt: 'The Oyako Hotel lobby in the afternoon, with its travertine stair',
      scrollHint: 'Scroll to discover',
    },

    /* --------------------------------------------------------------- rooms */
    // pricePerNight is US dollars. inventory is how many of this room exist,
    // and is what "Only 2 left" is counted against. rarity (0-1) is how quickly
    // the deterministic model sells this room out.
    roomsIntro: {
      eyebrow: 'Accommodation',
      heading: 'Rooms &amp; Suites',
      lede:
        'Five ways to stay, from the tailored Classic Room to the whole of the ' +
        'twenty-first floor.',
    },
    rooms: [
      {
        id: 'classic',
        name: 'Classic Room',
        size: '38 m²',
        bed: 'King',
        maxGuests: 2,
        pricePerNight: 240,
        inventory: 28,
        rarity: 0.05,
        image: 'assets/img/room-classic.jpg',
        imageAlt: 'A Classic Room with a king bed and patterned wall panels',
        description:
          'A calm, tailored room high above Maitama, looking out over the capital.',
      },
      {
        id: 'deluxe',
        name: 'Deluxe Room',
        size: '46 m²',
        bed: 'King or Twin',
        maxGuests: 2,
        pricePerNight: 320,
        inventory: 22,
        rarity: 0.12,
        image: 'assets/img/room-deluxe.jpg',
        imageAlt: 'A Deluxe Room with corner windows overlooking the Abuja skyline',
        description:
          'Corner windows framing the Abuja skyline at dusk, and a sofa built for the long view.',
      },
      {
        id: 'junior-suite',
        name: 'Junior Suite',
        size: '62 m²',
        bed: 'King',
        maxGuests: 3,
        pricePerNight: 480,
        inventory: 12,
        rarity: 0.26,
        image: 'assets/img/suite-junior.jpg',
        imageAlt: 'A Junior Suite with a separate sitting room',
        description:
          'A separate sitting room, a walk-in dressing area and a second window onto the water.',
      },
      {
        id: 'executive-suite',
        name: 'Executive Suite',
        size: '90 m²',
        bed: 'King',
        maxGuests: 3,
        pricePerNight: 760,
        inventory: 6,
        rarity: 0.38,
        image: 'assets/img/suite-executive.jpg',
        imageAlt: 'An Executive Suite with panelled study and Club Lounge access',
        description:
          'A panelled study, butler service and the Club Lounge on the twentieth floor.',
      },
      {
        id: 'presidential-suite',
        name: 'Presidential Suite',
        size: '210 m²',
        bed: 'King',
        maxGuests: 4,
        pricePerNight: 1450,
        inventory: 3,
        rarity: 0.52,
        image: 'assets/img/suite-presidential.jpg',
        imageAlt: 'The Presidential Suite with its terrace pool above the city',
        description:
          'The whole of the twenty-first floor, its own terrace pool, and a dining room for eight.',
      },
    ],

    /* -------------------------------------------------------------- dining */
    dining: {
      eyebrow: 'Dining',
      heading: 'Two rooms, two moods',
      lede:
        'A ground-floor brasserie that runs from breakfast to late, and a bronze-lit ' +
        'bar on the twenty-first floor.',
      venues: [
        {
          name: 'Savannah Room',
          kind: 'Restaurant · Ground floor',
          hours: 'Breakfast 06:30 – 11:00 · Lunch 12:30 – 15:00 · Dinner 18:30 – 23:00',
          description:
            'West African and European cooking, a long marble counter and a garden ' +
            'terrace. The room is daylit at lunch and candlelit after eight.',
          image: 'assets/img/brasserie.jpg',
          imageAlt: 'The Savannah Room brasserie, laid for dinner',
          gallery: [
            { image: 'assets/img/dining-room.jpg', alt: 'The Savannah Room dining room' },
            { image: 'assets/img/dining-salon.jpg', alt: 'A private dining salon' },
            { image: 'assets/img/dining-detail.jpg', alt: 'A table set for two' },
          ],
        },
        {
          name: 'Bronze Bar',
          kind: 'Bar · Twenty-first floor',
          hours: 'Daily 17:00 – 01:00 · Live trio Thursday to Saturday',
          description:
            'Cocktails built on Nigerian botanicals, low light and a west-facing terrace ' +
            'that catches the hour when the capital turns gold.',
          image: 'assets/img/bar-lounge.jpg',
          imageAlt: 'The Bronze Bar lounge, lit for the evening',
          gallery: [
            { image: 'assets/img/bar-detail.jpg', alt: 'Curved leather seating in the Bronze Bar' },
            { image: 'assets/img/city-night.jpg', alt: 'The city skyline at night' },
            { image: 'assets/img/city-dusk.jpg', alt: 'The city skyline at sunset' },
          ],
        },
      ],
    },

    /* ------------------------------------------------------------ wellness */
    wellness: {
      eyebrow: 'Spa & Wellness',
      heading: 'Spa, pool and gym',
      lede:
        'On the fourth floor, a spa of six treatment rooms, a lap pool under a ' +
        'rooflight, and a gym that never closes.',
      image: 'assets/img/spa-pool.jpg',
      imageAlt: 'The spa pool beneath a circular rooflight',
      facilities: [
        {
          name: 'Oyako Spa',
          meta: 'Six treatment rooms · Daily 09:00 – 21:00',
          description:
            'Massage, facials and body rituals using cold-pressed oils blended in Abuja.',
          image: 'assets/img/spa-treatment.jpg',
          imageAlt: 'A spa treatment room',
        },
        {
          name: 'Hammam & plunge',
          meta: 'Steam, scrub and cold plunge · Daily 09:00 – 21:00',
          description:
            'A tiled hammam, a scrub room and a cold plunge, booked in ninety-minute rituals.',
          image: 'assets/img/spa-bath.jpg',
          imageAlt: 'The tiled hammam and plunge area',
        },
        {
          name: 'Lap pool',
          meta: '18 metres · Rooflight · Towels and loungers provided',
          description:
            'A quiet saltwater pool on the fourth floor, kept at 28 degrees all year.',
          image: 'assets/img/pool-lap.jpg',
          imageAlt: 'The lap pool',
        },
        {
          name: 'Fitness studio',
          meta: 'Open 24 hours · Free weights · Technogym cardio',
          description:
            'Free weights, cardio and a stretching studio, with personal trainers on request.',
          image: 'assets/img/gym.jpg',
          imageAlt: 'The fitness studio',
        },
      ],
    },

    /* ------------------------------------------------------------- gallery */
    gallery: {
      eyebrow: 'Gallery',
      heading: 'The house, room by room',
      lede: 'Fourteen views of the hotel, from the lobby to the twenty-first floor.',
      images: [
        { image: 'assets/img/lobby.jpg', alt: 'The lobby and travertine stair', caption: 'Lobby' },
        { image: 'assets/img/reception.jpg', alt: 'The reception desk', caption: 'Reception' },
        { image: 'assets/img/concierge.jpg', alt: 'The concierge desk', caption: 'Concierge' },
        { image: 'assets/img/corridor.jpg', alt: 'A guest corridor', caption: 'Guest floors' },
        { image: 'assets/img/hero-suite.jpg', alt: 'A suite with a king bed and seating area', caption: 'Suites' },
        { image: 'assets/img/suite-lounge.jpg', alt: 'A suite sitting room', caption: 'Suite lounge' },
        { image: 'assets/img/city-view-suite.jpg', alt: 'A room with a wide window over the city', caption: 'City views' },
        { image: 'assets/img/bath-vanity.jpg', alt: 'A marble bathroom', caption: 'Bathrooms' },
        { image: 'assets/img/room-detail-bed.jpg', alt: 'A bedside lamp', caption: 'Details' },
        { image: 'assets/img/dining-salon.jpg', alt: 'A private dining salon', caption: 'Private dining' },
        { image: 'assets/img/bar-lounge.jpg', alt: 'The Bronze Bar', caption: 'Bronze Bar' },
        { image: 'assets/img/pool-lap.jpg', alt: 'The lap pool', caption: 'Lap pool' },
        { image: 'assets/img/city-night.jpg', alt: 'The city at night', caption: 'The city after dark' },
        { image: 'assets/img/city-dusk.jpg', alt: 'The city skyline at sunset', caption: 'Sunset' },
      ],
    },

    /* ------------------------------------------------------------- reviews */
    reviews: {
      eyebrow: 'Guest reviews',
      heading: 'What guests say',
      lede: 'A selection of recent stays, lightly edited.',
      items: [
        {
          quote:
            'The quietest room I have stayed in anywhere in Abuja, and the only one ' +
            'where I have been happy to work from the desk all afternoon.',
          name: 'Adaeze O.',
          origin: 'Kaduna, Nigeria',
          stay: 'Junior Suite · 4 nights',
          rating: 5,
        },
        {
          quote:
            'We took the presidential floor for a family week. The terrace pool at ' +
            'sunset is worth the whole booking.',
          name: 'Marcus L.',
          origin: 'London, United Kingdom',
          stay: 'Presidential Suite · 7 nights',
          rating: 5,
        },
        {
          quote:
            'Breakfast in the Savannah Room is the reason I stopped eating anywhere else ' +
            'in the mornings. Staff remembered my order by day two.',
          name: 'Chidi N.',
          origin: 'Port Harcourt, Nigeria',
          stay: 'Deluxe Room · 3 nights',
          rating: 5,
        },
        {
          quote:
            'Booked entirely over WhatsApp in about ten minutes. Arrived at 1am and ' +
            'the concierge had everything ready.',
          name: 'Sophie R.',
          origin: 'Accra, Ghana',
          stay: 'Classic Room · 2 nights',
          rating: 4,
        },
      ],
    },

    /* ------------------------------------------------------------ location */
    location: {
      eyebrow: 'Location',
      heading: 'Maitama, Abuja',
      lede:
        'In the heart of Maitama, ten minutes from the Central Business District and ' +
        'the National Mosque.',
      image: 'assets/img/city-day.jpg',
      imageAlt: 'The Abuja skyline in daylight',
      // Shown inside the diagram; keep to short labels.
      diagramLabel: 'Maitama',
      diagramNote: 'Stylised location diagram · not to scale',
      distances: [
        { label: 'Central Business District', value: '10 min' },
        { label: 'Aso Rock', value: '12 min' },
        { label: 'Millennium Park', value: '6 min' },
        { label: 'Jabi Lake', value: '20 min' },
        { label: 'Nnamdi Azikiwe Int’l Airport', value: '40 min' },
      ],
    },

    /* -------------------------------------------------------------- footer */
    footer: {
      blurb:
        'A house of ninety-four rooms and suites in the heart of Abuja, open all year.',
      columns: [
        {
          heading: 'Stay',
          links: [
            { label: 'Rooms & Suites', href: '#rooms' },
            { label: 'Dining', href: '#dining' },
            { label: 'Spa & Wellness', href: '#wellness' },
            { label: 'Gallery', href: '#gallery' },
          ],
        },
        {
          heading: 'Visit',
          links: [
            { label: 'Location', href: '#location' },
            { label: 'Guest reviews', href: '#reviews' },
            { label: 'Contact', href: '#contact' },
          ],
        },
      ],
      legal:
        '<em>©</em> 2026 Oyako Hotel Limited. All rights reserved. Oyako Hotel ' +
        'Limited is registered in Nigeria.',
    },
  };
})();
