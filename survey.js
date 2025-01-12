document.addEventListener('alpine:init', () => {
    Chart.defaults.font.family = 'Funnel Sans';
    Chart.defaults.font.size = 20;

    Alpine.data('survey', () => {

        let voteChart = null;

        return {

            enabled: false,

            get voteOptions() {
                return voteChart.data.labels;
            },
            set voteOptions(value) {
                voteChart.data.labels = value;
            },

            get votes() {
                return voteChart.data.datasets[0].data;
            },
            set votes(value) {
                voteChart.data.datasets[0].data = value;
            },

            title: null,

            users: new Set(),

            error: null,

            init() {
                this.options = this.getOptions();

                if (!this.options.channel) {
                    this.error = 'No channel provided';
                    return;
                }

                voteChart = new Chart(this.$refs.canvas, {
                    plugins: [ChartDataLabels],
                    type: 'bar',
                    data: {
                        datasets: [
                            {
                                label: 'Votes',
                                data: []
                            }
                        ],
                        labels: []
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                top: 30
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false },
                            datalabels: {
                                anchor: 'end',
                                align: 'top'
                            }
                        },
                        scales: {
                            y: {
                                display: false,
                                beginAtZero: true,
                            },
                            x: {
                                grid: { display: false }
                            },
                        }
                    }
                });

                this.client = new tmi.Client({
                    options: { debug: false },
                    channels: [this.options.channel]
                });

                this.client.connect()
                    .catch(console.error);

                this.client.on('message', this.handleMessage.bind(this));
            },

            updateChart(mode) {
                this.$nextTick(() => voteChart.update(mode));
            },

            handleMessage(_, user, message) {
                if (!message) {
                    return;
                }

                this.handleManagerAction(user, message);

                if (!this.enabled || this.users.has(user.username)) {
                    return;
                }

                const index = this.voteOptions.indexOf(message.toUpperCase());

                if (index === -1) {
                    return;
                }

                if (!this.options.debug) {
                    this.users.add(user.username);
                }

                this.votes[index]++;
                this.updateChart();
            },

            handleManagerAction(user, message) {
                if (!this.isManager(user)) {
                    return;
                }

                const argsRe = /\S+/g;
                const args = [...message.matchAll(argsRe)]
                    .map(a => a[0]);

                switch (args[0]) {
                    case '!newvote':
                        this.startNewVote(args[1], args.slice(2).join(' '));
                        break;

                    case '!showvote':
                        this.enabled = true;
                        break;

                    case '!hidevote':
                        this.enabled = false;
                        break;

                    case '!resetvote':
                        this.reset();
                        break;

                    case '!votetitle':
                        if (!this.enabled) {
                            break;
                        }

                        this.title = args.slice(1).join(' ');
                        this.updateChart();
                        break;
                }
            },

            startNewVote(options, title) {
                const voteOptions = this.parseVoteOptions(options);

                if (!voteOptions) {
                    console.log('Invalid vote options', options);
                    return;
                }

                this.reset();

                this.enabled = true;
                this.voteOptions = voteOptions;
                this.votes = new Array(voteOptions.length);
                this.votes.fill(0);
                this.title = title;

                this.updateChart();
            },

            parseVoteOptions(options) {
                if (!options) {
                    return null;
                }

                const charMatch = options.match(/([A-Z])-([A-Z])/i);

                if (charMatch) {
                    const voteOptions = [];
                    const start = charMatch[1].toUpperCase().charCodeAt(0);
                    const end = charMatch[2].toUpperCase().charCodeAt(0);

                    if (start >= end) {
                        return null;
                    }

                    for (let i = start; i <= end; i++) {
                        voteOptions.push(String.fromCharCode(i));
                    }

                    return voteOptions;
                }

                const numberMatch = options.match(/(\d+)-(\d+)/);

                if (numberMatch) {
                    const voteOptions = [];
                    const start = parseInt(numberMatch[1]);
                    const end = parseInt(numberMatch[2]);

                    if (start >= end) {
                        return null;
                    }

                    for (let i = start; i <= end; i++) {
                        voteOptions.push(i.toString());
                    }

                    return voteOptions;
                }

                return null;
            },

            reset() {
                this.enabled = false;
                this.users.clear();
                this.votes = [];
                this.voteOptions = [];
                this.title = null;

                this.updateChart();
            },

            getOptions() {
                const params = new URLSearchParams(window.location.search);

                return {
                    channel: params.get('channel'),
                    debug: params.get('debug') === 'true'
                };
            },

            isManager(user) {
                return user.mod
                    || user.username === 'dascleverle'
                    || user.username.localeCompare(this.options.channel, 'en-US', { sensitivity: 'accent' }) === 0;
            },

        }
    });
});

