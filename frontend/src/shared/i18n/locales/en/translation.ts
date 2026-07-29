export const en = {
  translation: {
    app: { title: 'PinGo' },
    page: {
      home: 'Home',
      user: 'User',
      counselor: 'Counselor',
      admin: 'Admin',
      notFound: 'Page not found',
    },
    home: {
      eyebrow: 'Indoor navigation for the subway',
      headline: 'Find your way out\nof any busy station',
      lede: 'Underground, where GPS cannot reach, PinGo locates you with the camera and guides you step by step to your destination.',
      enterTitle: 'Which console do you need?',
      enter: 'Enter',
      role: {
        user: 'Find your way inside the station and ask for help',
        counselor: 'Take requests and guide users on a shared screen',
        admin: 'Manage stations, facilities, routes and counselor accounts',
      },
      feature: {
        locate: {
          title: 'Camera positioning',
          desc: 'Pan once around you and PinGo pinpoints where you stand',
        },
        route: { title: 'Indoor routing', desc: 'Turn-by-turn guidance across floors to the exit' },
        consult: {
          title: 'Live consultation',
          desc: 'Share your screen and get guided with translation',
        },
      },
    },
    indoorMap: {
      loading: 'Loading the map…',
      error: 'Failed to load the map',
      empty: 'No map is registered',
      floorNotFound: 'No map for this floor',
      imageAlt: '{{floorCode}} indoor map',
      overlay: {
        currentLocation: 'Current location',
        destination: 'Destination',
        route: 'Route',
      },
    },
  },
} as const;
