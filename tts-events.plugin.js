//META{"name":"TTSEvents"}*//

/* global console, BdApi, BDfunctionsDevilBro*/

// TTSEvents Plugin for a friend of mine.
// Works under BD v0.2.82, JS v1.792 by Jiiks
//             BBD v0.0.6 by Zerebos

let AUTHOR = 'Semnodime'
let VERSION = '1.1.0'

let A = 'TTS-EVENTS'
let debug = false

class ChannelEvent {
    constructor(username, type, channel, channel_2) {
        this.username = username
        this.joined = (type === 'joined')
        this.moved = (type === 'moved')
        this.disconnected = (type === 'disconnected')
        this.channel = channel
        this.from = channel
        this.to = channel_2
    }
}

class VoiceChannel {
    constructor(name, users, current) {
        this.name = name
        this.users = users
        this.current = current
    }

    has_user(username) {
        return (undefined !== this.users.find(user => (user === username)))
    }
}

class User {
    constructor(name) {
        this.name = name
        this.channel_before = undefined
        this.channel_after = undefined
    }
}

class TTSEvents {
    // Static Class
    static getName() {
        return 'TTS-Events'
    }

    static getShortName() {
        return 'ttsEvents'
    }

    static getDescription() {
        return 'Plays text-to-speech messages on events such as users joining your voice channel.' + 'Limitation: VoiceChannel must be visible in Discord in order to be recognized by this plugin'
    }

    static getVersion() {
        return VERSION
    }

    static getAuthor() {
        return AUTHOR
    }

    // Plugin Interface Base

    getName() {
        return TTSEvents.getName()
    }

    getShortName() {
        return TTSEvents.getShortName()
    }

    getDescription() {
        return TTSEvents.getDescription()
    }

    getVersion() {
        return TTSEvents.getVersion()
    }

    getAuthor() {
        return TTSEvents.getAuthor()
    }

    getSettingsPanel() {
        let self = this
        if (!this.started || typeof BDfunctionsDevilBro !== 'object') {
            console.error(A, 'getSettingsPanel Failed')
            return
        }

        let save_key = TTSEvents.getShortName() + '-settings'

        let loaded_settings = BDfunctionsDevilBro.loadAllData(this, save_key)
        window.console.log(A, 'LOAD_SETTINGS', loaded_settings, loaded_settings.length)

        if (!$.isEmptyObject(loaded_settings)) {
            this.settings = loaded_settings
        }
        console.log(A, 'ACTUAL_SETTINGS', this.settings, 'default', this.defaults, 'loaded', loaded_settings)

        let html = `<div class="bda-header"><span class="bda-header-title"><span class="bda-name">${TTSEvents.getName() + ' Settings'}</span> v<span class="bda-version">${TTSEvents.getVersion()}</span> by <span class="bda-author">${TTSEvents.getAuthor()}</span></span></div>`
        for (let key in this.settings) {
            if (this.settings.hasOwnProperty(key)) {
                //console.log(A, 'iterator', self.settings[key].value, self.defaults[key].value, 'input-' + key)
                html += `<div class="flex-3B1Tl4 tooltip-custom" style="margin: 5px 0">`
                html += `   <h3 style="flex: 0 0 50%; line-height: 38px; align-self:baseline">${this.defaults[key].description}</h3>`
                html += `   <div style="flex: 1 1 auto;" class="inputWrapper-3xoRWR vertical-3X17r5 flex-3B1Tl4 align-self:baseline">`
                html += `     <input type="text" value="${self.settings[key].value}" placeholder="${self.defaults[key].value}" class="inputDefault-Y_U37D input-2YozMi size16-3IvaX_" id="${'input-' + key}">`
                html += `     <span class="tooltiptext-custom">${self.defaults[key].tooltip}</span>`
                html += `    </div>`
                html += `</div>`
            }
        }

        // For some reason you nead to wrap everything in ONE div
        let settingshtml = `<div>${html}</div>`

        let settingspanel = $(settingshtml)[0]

        BDfunctionsDevilBro.initElements(settingspanel)

        function sanatize(input) {
            // Make values save to be printed into html value attribute (between "")
            // Whitelist approach
            return ('' + input).replace(/[^a-zA-Z0-9äÄöÖüÜ %._]+/g, '')
        }

        for (let key in this.settings) {
            if (this.settings.hasOwnProperty(key)) {
                $(settingspanel).on('change', '#input-' + key, function () {
                    // Sanatize Value
                    let v = sanatize(this.value)
                    // Validate Value
                    v = self.defaults[key].validator(v)
                    // Save Value
                    self.settings[key].value = v
                    console.log(A, 'SAVE_SETTINGS', self.settings)
                    BDfunctionsDevilBro.saveAllData(self.settings, self, save_key)
                })
            }
        }

        return settingspanel
    }

    // Plugin Constructor
    constructor() {
        let self = this

        function voice_sample() {
            setTimeout(function () {
                self.speak('Test voice sample')
            }, 42)
        }

        this.channelCache = []
        console.log(A, 'CONSTRUCTOR CALLED')
        this.defaults = {
            speech_volume: {
                value: '100',
                description: 'Speech Volume %',
                tooltip: 'Value from  Mute: 0 to 100 :Loud',
                validator: function (v) {
                    let d = self.defaults.speech_volume.value
                    v = parseInt(v)
                    if (isNaN(v) || v < 0 || v > 100)
                        return d
                    voice_sample()
                    return v
                }
            },
            speech_rate: {
                value: '10',
                description: 'Speech Rate',
                tooltip: 'Value from  Slow: 0 to 100 :Fast',
                validator: function (v) {
                    let d = self.defaults.speech_rate.value
                    v = parseInt(v)
                    if (isNaN(v)) return d
                    if (v < 0 || v > 100)
                        return d
                    voice_sample()
                    return v
                }
            },
            speech_pitch: {
                value: '10',
                description: 'Voice Pitch',
                tooltip: 'Value from  Low: 0 to 100 :High',
                validator: function (v) {
                    let d = self.defaults.speech_pitch.value
                    v = parseInt(v)
                    if (isNaN(v) || v < 0 || v > 100)
                        return d
                    voice_sample()
                    return v
                }
            },
            message_join: {
                value: 'User %u joined from channel %f',
                description: 'User joined',
                tooltip: '%u=User %f=Channel',
                validator: function (v) {
                    let d = self.defaults.message_join.value
                    if (v.length === 0)
                        return d
                    return v
                }
            },
            message_disconnect: {
                value: 'User %u left channel %f',
                description: 'User disconnection',
                tooltip: '%u=User %f=Channel',
                validator: function (v) {
                    let d = self.defaults.message_disconnect.value
                    if (v.length === 0)
                        return d
                    return v
                }
            },
            message_moved_in: {
                value: 'User %u moved here from channel %f',
                description: 'User moved & joined',
                tooltip: '%u=User %f=ChannelFrom %t=ChannelTo',
                validator: function (v) {
                    let d = self.defaults.message_moved_in.value
                    if (v.length === 0)
                        return d
                    return v
                }
            },
            message_moved_out: {
                value: 'User %u moved to channel %t',
                description: 'User moved & disconnected',
                tooltip: '%u=User %f=ChannelFrom %t=ChannelTo',
                validator: function (v) {
                    let d = self.defaults.message_moved_out.value
                    if (v.length === 0)
                        return d
                    return v
                }
            },
        }
        this.settings = this.defaults
        this.style = `<style>
.tooltip-custom {
    position: relative;
}

.tooltip-custom .tooltiptext-custom {
    visibility: hidden;
    min-width: 120px;
    max-width: 50%;
    background-color: #555;
    color: #fff;
    text-align: center;
    border-radius: 6px;
    padding: 5px 0;
    position: absolute;
    z-index: 1;
    bottom: 20%;
    left: 15%;
    margin-left: -60px;
    opacity: 0;
    transition: opacity 0.3s;
}

.tooltip-custom .tooltiptext-custom::after {
    content: "";
    position: absolute;
    top: 20%;
    left: 0%;
    margin-left: -14px;
    border: 7px solid transparent border-right-color: #555;
}

.tooltip-custom:hover .tooltiptext-custom {
    visibility: visible;
    opacity: 0.9;
}
</style>`
    }

    // Plugin Interface for Start/Stop
    load() {
        console.log(A, 'LOADED')
        if (debug)
            this.speak(A + 'LOADED')
    }

    unload() {
        console.log(A, 'UNLOADED')
        if (debug)
            this.speak(A + 'UNLOADED')
    }

    start() {
        this.started = true
        this.initialize()
        this.startCache()
        console.log(A, 'STARTED')
        if (debug)
            this.speak(A + 'STARTED')
    }

    initialize() {
        if (typeof BDfunctionsDevilBro === 'object')
            BDfunctionsDevilBro.loadMessage(this)

        BdApi.injectCSS(this.getShortName(), this.style)
        console.log(A, 'INITIALIZED')
        if (debug)
            this.speak(A + 'INITIALIZED')
    }

    stop() {
        this.started = false
        if (typeof BDfunctionsDevilBro === 'object')
            BDfunctionsDevilBro.unloadMessage(this)
        this.stopCache()
        BdApi.clearCSS(this.getShortName())
        console.log(A, 'STOPPED')
        if (debug)
            this.speak(A + 'STOPPED')
    }

    // Own Plugin Helper Functions
    startCache() {
        let self = this
        this.cacheInterval = setInterval(function () {
            self.watch()
        }, 1000);
    }

    stopCache() {
        if (this.cacheInterval !== undefined)
            clearInterval(this.cacheInterval)
    }

    ownUsername() {
        // Return own username from UI DOM
        let user_div_result = $('.container-iksrDt .username')
        if (user_div_result.length > 0)
            return $(user_div_result).text()
    }

    ownChannel() {
        // Return own username from getVoiceChannels()
        let self = this
        let channel = this.getVoiceChannels().find(channel => channel.has_user(self.ownUsername()))
        if (channel)
            return channel.name
    }

    getDeafened() {
        // Check if the user is deafened from UI DOM
        let deafened_bg = 'url("/assets/c8845c514bbf3f1e5bea064c1e40b08d.svg")'
        let deafened_results = $('.button-1aU9q1').filter((i, elem) => (elem.style['background-image'] === deafened_bg))
        return deafened_results.length === 1
    }

    getVoiceChannels() {
        // Get the list of voice channels and their users from the UI DOM
        let voiceChannels = []

        let voiceChannel_Containers = $('.containerDefault-7RImuF')
        voiceChannel_Containers.each(function (index, container) {
            let channel_name = $($(container).find('.name-2SL4ev')[0]).text()
            let channel_is_selected = ($(container).find('.nameSelectedVoice-XpjYTw').length !== 0)
            let channel_user_DIVs = $(container).find('.nameDefault-1I0lx8, .nameHovered-28u_Fz')
            let usernames = []
            channel_user_DIVs.each(function (index, user_DIV) {
                usernames.push($(user_DIV).text())
            })
            let voiceChannel = new VoiceChannel(channel_name, usernames, channel_is_selected)
            voiceChannels.push(voiceChannel)
        })

        return voiceChannels
    }

    compareVoiceChannelLists(before_list, after_list) {
        // Compare two lists of voice channels to find join/disconnect/move actions

        // Collect all users of all channels from before and after
        let combined_users = {}
        before_list.forEach(function (voiceChannel_before) {
            voiceChannel_before.users.forEach(function (username) {
                if (!combined_users[username])
                    combined_users[username] = {}
                combined_users[username].channel_before = voiceChannel_before.name
            })
        })
        after_list.forEach(function (voiceChannel_after) {
            voiceChannel_after.users.forEach(function (username) {
                if (!combined_users[username])
                    combined_users[username] = {}
                combined_users[username].channel_after = voiceChannel_after.name
            })
        })

        // Assign channel before/after to users
        let users = []
        for (let name in combined_users) {
            if (combined_users.hasOwnProperty(name)) {
                let user = new User(name)
                user.channel_before = combined_users[name].channel_before
                user.channel_after = combined_users[name].channel_after
                users.push(user)
            }
        }

        // Recognize user join/disconnect/move actions
        let events = []
        users.forEach(function (user) {
            if (user.channel_before !== user.channel_after) {
                let event

                if (!user.channel_before)
                    event = new ChannelEvent(user.name, 'joined', user.channel_after)
                else if (!user.channel_after)
                    event = new ChannelEvent(user.name, 'disconnected', user.channel_before)
                else
                    event = new ChannelEvent(user.name, 'moved', user.channel_before, user.channel_after)

                events.push(event)
            }
        })

        return events
    }

    playNotification(channelEvent) {
        // Log and Speak the event with the selected message texts
        let verbosity = 'short' // short/long // Select message text
        let strip_shit = true // Only speak [a-z0-9_\ ] symbols

        let ownChannel = this.ownChannel()
        let ownUsername = this.ownUsername()
        let is_local_action = (ownChannel === channelEvent.from) || (ownChannel === channelEvent.to)
        let is_own_action = (channelEvent.username === ownUsername)
        // Check if user joined/left/moved(from/to) own channel
        if (is_local_action)
            verbosity = 'local'

        // Define default message texts
        let messages = {
            short: {
                joined: '%u joined %c',
                disconnected: '%u left %c',
                moved: '%u moved from %f to %t',
            },
            local: {
                joined: this.settings.message_join.value,
                disconnected: this.settings.message_disconnect.value,
                moved_in: this.settings.message_moved_in.value,
                moved_out: this.settings.message_moved_out.value,
            },
        }

        // Select message text
        let msg = ''
        if (channelEvent.joined)
            msg = messages[verbosity].joined
        if (channelEvent.disconnected)
            msg = messages[verbosity].disconnected
        if (channelEvent.moved) {
            if (verbosity === 'local') {
                if (channelEvent.from === ownChannel)
                    msg = messages[verbosity].moved_out
                if (channelEvent.to === ownChannel)
                    msg = messages[verbosity].moved_in
            } else {
                msg = messages[verbosity].moved
            }
        }
        if (channelEvent.disconnected)
            msg = messages[verbosity].disconnected

        // Format message with username and channel info
        msg = msg.replace('%u', channelEvent.username)
        msg = msg.replace('%c', channelEvent.channel)
        msg = msg.replace('%f', channelEvent.from)
        msg = msg.replace('%t', channelEvent.to)

        // Log whats going on
        console.log(A, msg)

        if (strip_shit)
            msg = msg.replace(/[^ a-zA-Z0-9]+/g, '')


        // Dont speak when deafened
        if (this.getDeafened())
            return

        // Dont mention own actions
        if (is_own_action)
            if (!debug)
                return

        console.log(A, 'Speech:', msg)
        console.log(A, 'Is Local Action:', is_local_action)

        // Only mention local channel actions [if option is set]
        if (!is_local_action)
            if (!debug)
                return
        // Speak message
        this.speak(msg);
    }

    watch() {
        // Check visible voice channels for events and log / speak them
        let before = this.channelCache
        let after = this.getVoiceChannels()
        this.channelCache = after

        console.log(A, after.length, 'Channels being watched: ' + after.map(channel => channel.name))

        let events = this.compareVoiceChannelLists(before, after)
        let self = this
        events.forEach(function (event) {
            self.playNotification(event)
        })
    }

    speak(text) {
        let speech = new window.SpeechSynthesisUtterance(text)
        let voices = window.speechSynthesis.getVoices()

        speech.volume = parseInt(this.settings.speech_volume.value) / 100 // Range 0-100 in settings
        speech.rate = parseInt(this.settings.speech_rate.value) / 10 // Range 0-100 in settings
        speech.pitch = parseInt(this.settings.speech_pitch.value) / 20 // Range 0-100 in settings

        speech.voice = voices[0]

        window.speechSynthesis.speak(speech);
    }
}
