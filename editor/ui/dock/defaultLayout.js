export const ROBLOX_LAYOUT = {
  type: 'split',
  direction: 'horizontal',
  sizes: [0.22, 0.78],
  children: [
    {
      type: 'stack',
      id: 'stack-explorer',
      tabs: ['explorer'],
      active: 'explorer',
    },
    {
      type: 'split',
      direction: 'horizontal',
      sizes: [0.7, 0.3],
      children: [
        {
          type: 'split',
          direction: 'vertical',
          sizes: [0.65, 0.35],
          children: [
            {
              type: 'stack',
              id: 'stack-viewport',
              tabs: ['viewport'],
              active: 'viewport',
            },
            {
              type: 'split',
              direction: 'horizontal',
              sizes: [0.6, 0.4],
              children: [
                {
                  type: 'stack',
                  id: 'stack-console',
                  tabs: ['console'],
                  active: 'console',
                },
                {
                  type: 'stack',
                  id: 'stack-assets',
                  tabs: ['assets'],
                  active: 'assets',
                },
              ],
            },
          ],
        },
        {
          type: 'stack',
          id: 'stack-properties',
          tabs: ['properties'],
          active: 'properties',
        },
      ],
    },
  ],
};
