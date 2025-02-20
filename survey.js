document.addEventListener('alpine:init', () => {
    Chart.defaults.color = '#000';
    Chart.defaults.font.family = 'Funnel Sans';
    Chart.defaults.font.size = 20;

    const numberFormat = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2
    });

    Alpine.data('survey', () => {

        let voteChart = null;
        const colors = [
            '#1f55a6',
            '#2b3022',
            '#209380',
            '#ba2749',
            '#350b32',
            '#bab70f',
            '#66617c',
            '#720d66',
            '#09ea72',
            '#afaaae',
            '#57b74e',
            '#896d9e',
            '#a56d47',
            '#6d5a47',
            '#2abfc1',
            '#c466a6',
            '#040504',
            '#d10412',
            '#5b595a',
            '#92a075',
        ];

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

            totalCount: 0,
            median: 0,
            mean: 0,

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
                                data: [],
                                backgroundColor(value) {
                                    return colors[value.index % colors.length];
                                }
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

            update(mode) {
                const totalCount = this.votes.reduce((acc, v) => acc + v, 0);
                const middle = Math.floor(totalCount / 2);
                const medianList = this.votes.flatMap((vote, index) => {
                    const array = new Array(vote);
                    array.fill(index);
                    return array;
                });

                const meanIndex = this.votes.reduce((acc, vote, index) => acc + vote * (index + 1), 0) / totalCount - 1;
                const mean = this.voteOptions[Math.round(meanIndex)];

                this.totalCount = totalCount;
                this.median = this.voteOptions[medianList[middle]] ?? '-';
                this.mean = (parseInt(mean)
                    ? numberFormat.format(meanIndex + parseInt(this.voteOptions[0]))
                    : mean
                ) ?? '-';

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
                this.update();
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
                        this.votes = new Array(this.voteOptions.length);
                        this.votes.fill(0);
                        this.update();
                        break;

                    case '!votetitle':
                        if (!this.enabled) {
                            break;
                        }

                        this.title = args.slice(1).join(' ');
                        this.update();
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

                this.update();
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

                this.update();
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

