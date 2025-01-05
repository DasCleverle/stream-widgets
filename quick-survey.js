document.addEventListener('alpine:init', () => {
    Alpine.data('quickSurvey', () => ({

        enabled: true,

        lastVote: null,
        users: new Set(),
        votes: {},

        timeout: null,

        voteOptions: [],

        get totalCount() {
            return Object.values(this.votes).reduce((acc, v) => acc + v, 0);
        },

        init() {
            this.options = this.getOptions();

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

            if (!this.enabled || this.users.has(user['display-name'])) {
                return;
            }

            const vote = parseInt(message);

            if (isNaN(vote) || !this.voteOptions.includes(vote)) {
                return;
            }

            if (this.timeout) {
                clearTimeout(this.timeout);
            }

            this.timeout = setTimeout(() => this.reset(), this.options.timeout * 1000);
            this.users.add(user['display-name']);

            if (!this.votes[vote]) {
                this.votes[vote] = 1;
            }
            else {
                this.votes[vote]++;
            }
        },

        handleManagerAction(user, message) {
            if (!this.isManager(user)) {
                return;
            }

            switch (message) {
                case '!qsenable':
                    this.enabled = true;
                    break;

                case '!qsdisable':
                    this.enabled = false;
                    break;

                case '!qsreset':
                    this.reset();
                    break;
            }
        },

        reset() {
            this.lastVote = null;
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
                voteOptions: parseInt(params.get('voteOptions') ?? params.get('voteoptions') ?? 2)
            };
        },

        isManager(user) {
            return user.mod
                || user['display-name'] === 'DasCleverle'
                || user['display-name'] === this.options.channel;
        },

        voteContainer: {
            ':class': '{ [`vote-${option}`]: true, hidden: !votes[option] }',
            ':style': '{ width: `${(votes[option] / totalCount * 100)}%` }',
            'x-text': 'votes[option]'
        }

    }));
});

