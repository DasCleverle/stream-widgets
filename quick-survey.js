document.addEventListener('alpine:init', () => {
    Alpine.data('quickSurvey', () => ({

        enabled: true,

        users: new Set(),
        votes: {},

        timeout: null,

        voteOptions: [],

        error: null,

        get dividerPositions() {
            const positions = [];

            for (let i = 1; i < this.maxVote; i++) {
                positions.push(i / this.maxVote * 100);
            }

            return positions;
        },

        get minVote() {
            return Object.keys(this.votes).reduce((acc, v) => acc === null || acc > v ? v : acc, null);
        },

        get maxVote() {
            return Object.keys(this.votes).reduce((acc, v) => acc === null || acc < v ? v : acc, null);
        },

        get totalCount() {
            return Object.values(this.votes).reduce((acc, v) => acc + v, 0);
        },

        init() {
            this.options = this.getOptions();

            if (!this.options.channel) {
                this.error = "No channel provided";
                return;
            }

            for (let i = 1; i <= this.options.voteOptions; i++) {
                this.voteOptions.push(i);
            }

            this.client = new tmi.Client({
                options: { debug: false },
                channels: [this.options.channel]
            });

            this.client.connect()
                .catch(console.error);

            this.client.on('message', this.handleMessage.bind(this));
        },


        handleMessage(_, user, message) {
            this.handleManagerAction(user, message);

            if (!this.enabled || this.users.has(user.username)) {
                return;
            }

            const vote = parseInt(message);

            if (isNaN(vote) || !this.voteOptions.includes(vote)) {
                return;
            }

            if (this.timeout) {
                clearTimeout(this.timeout);
            }

            if (this.options.timeout !== 0) {
                this.timeout = setTimeout(() => this.reset(), this.options.timeout * 1000);
            }

            if (!this.options.debug) {
                this.users.add(user.username);
            }

            if (!this.votes[vote]) {
                this.votes[vote] = 1;
            }
            else {
                this.votes[vote]++;
            }
        },

        handleManagerAction(user, message) {
            if (!this.isManager(user) || !message || typeof message !== 'string') {
                return;
            }

            switch (message.split(' ')[0]) {
                case '!hidevote':
                case '!qsenable':
                    this.enabled = true;
                    break;

                case '!newvote':
                case '!showvote':
                case '!qsdisable':
                    this.enabled = false;
                    break;

                case '!qsreset':
                    this.reset();
                    break;
            }
        },

        reset() {
            this.users.clear();
            this.votes = {};

            if (this.timeout) {
                clearTimeout(this.timeout);
            }
        },

        getOptions() {
            const params = new URLSearchParams(window.location.search);

            return {
                channel: params.get('channel'),
                timeout: parseInt(params.get('timeout') ?? params.get('to') ?? 30),
                minVotes: parseInt(params.get('minVotes') ?? params.get('minvotes') ?? 3),
                voteOptions: parseInt(params.get('voteOptions') ?? params.get('voteoptions') ?? 2),
                debug: params.get('debug') === 'true'
            };
        },

        isManager(user) {
            return user.mod
                || user.username === 'dascleverle'
                || user.username.localeCompare(this.options.channel, 'en-US', { sensitivity: 'accent' }) === 0;
        },

        voteBar: {
            ':class': `{
                [\`vote-\${option}\`]: true,
                hidden: !votes[option],
                first: minVote == option,
                last: maxVote == option
            }`,
            ':style': '{ width: `${(votes[option] / totalCount * 100)}%` }',
            'x-text': 'votes[option]'
        },

    }));
});

