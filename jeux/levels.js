const LEVELS = [
    // Level 1
    {
        width: 2000,
        height: 600,
        backgroundColor: '#87CEEB',
        platforms: [
            { x: 0, y: 550, w: 2000, h: 50, type: 'ground' }, // Floor
            { x: 300, y: 400, w: 200, h: 20, type: 'platform' },
            { x: 600, y: 300, w: 200, h: 20, type: 'platform' },
            { x: 900, y: 450, w: 100, h: 20, type: 'platform' },
            { x: 1100, y: 350, w: 100, h: 20, type: 'platform' },
            { x: 1300, y: 250, w: 200, h: 20, type: 'platform' },
        ],
        coins: [
            { x: 350, y: 350 },
            { x: 400, y: 350 },
            { x: 700, y: 250 },
            { x: 950, y: 400 },
            { x: 1150, y: 300 },
            { x: 1400, y: 200 },
        ],
        enemies: [
            { x: 500, y: 500, range: 100 },
            { x: 1000, y: 500, range: 150 },
        ],
        goal: { x: 1800, y: 450, w: 50, h: 100 }
    },
    // Level 2
    {
        width: 2000,
        height: 600,
        backgroundColor: '#2c3e50', // Night theme
        platforms: [
            { x: 0, y: 550, w: 500, h: 50, type: 'ground' },
            { x: 600, y: 550, w: 500, h: 50, type: 'ground' }, // Pit
            { x: 1200, y: 550, w: 800, h: 50, type: 'ground' },
            { x: 200, y: 400, w: 100, h: 20, type: 'platform' },
            { x: 400, y: 300, w: 100, h: 20, type: 'platform' },
            { x: 700, y: 400, w: 100, h: 20, type: 'platform' }, // Over pit
            { x: 900, y: 300, w: 100, h: 20, type: 'platform' },
        ],
        coins: [
            { x: 250, y: 350 },
            { x: 450, y: 250 },
            { x: 750, y: 350 },
            { x: 950, y: 250 },
        ],
        enemies: [
            { x: 300, y: 500, range: 100 },
            { x: 1400, y: 500, range: 200 },
            { x: 1600, y: 500, range: 100 },
        ],
        goal: { x: 1900, y: 450, w: 50, h: 100 }
    }
];
