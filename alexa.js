const Alexa = require('ask-sdk-core');
const https = require('https');

const fetchData = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        console.log('LaunchRequest triggered');

        try {
            const data = await fetchData('https://deadlines-bot.tobypob.workers.dev/api/get-events');
            console.log('API Response JSON:', data);

            if (data && data.length > 0) {
                const eventMessages = data.map(event => `${event.event} on ${event.date} at ${event.time}`).join('. ');
                const speechText = `Here are your upcoming deadlines: ${eventMessages}`;
                return handlerInput.responseBuilder.speak(speechText).getResponse();
            } else {
                return handlerInput.responseBuilder.speak('You have no upcoming deadlines.').getResponse();
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            return handlerInput.responseBuilder.speak('Sorry, I could not retrieve your deadlines at the moment.').getResponse();
        }
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('Skill Error:', error);
        return handlerInput.responseBuilder.speak('Sorry, an error occurred. Please try again later.').getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(LaunchRequestHandler)
    .addErrorHandlers(ErrorHandler)
    .lambda();
