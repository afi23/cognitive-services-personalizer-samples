﻿document.addEventListener("DOMContentLoaded", function () {
    const timeleftEle = document.getElementById("timeleft");
    const goBtnEle = document.getElementById("go-btn");
    let intervalId = -1;
    let reward = 0;
    let waiting = false;

    setupActionControls();
    setupContextControls();
    
    goBtnEle.addEventListener("click", function () {
        if (!waiting) {
            if (intervalId >= 0) {
                clearInterval(intervalId);
                intervalId = -1;
            }

            let counter = 15;
            waiting = true;
            reward = 0;
            updateRewardValue(reward);
            clearRewardmessage();

            getRecommendation().then(result => {
                waiting = false;
                updateBasedOnRecommendation(result);

                intervalId = setInterval(function () {
                    counter--;
                    timeleftEle.setAttribute("value", counter);
                    if (counter <= 0) {
                        clearInterval(intervalId);
                        intervalId = -1;
                        sendReward(result.eventId, reward).then(() => {
                            showRewardMessage(reward);
                        });
                    }
                }, 1000);
            });
        }
    });

    const articleViewer = document.getElementById("article-viewer");
    articleViewer.addEventListener("load", function () {
        const articleDoc = articleViewer.contentDocument;

        const maxScrollPosition = Math.max(articleDoc.body.scrollHeight, articleDoc.body.offsetHeight,
            articleDoc.documentElement.clientHeight, articleDoc.documentElement.scrollHeight, articleDoc.documentElement.offsetHeight)
            - articleViewer.contentWindow.innerHeight;

        articleDoc.addEventListener("scroll", function () {
            const currentPosition = articleViewer.contentWindow.pageYOffset;
            const newReward = parseFloat((currentPosition / maxScrollPosition).toFixed(2));
            if (intervalId >= 0 && reward < newReward) {
                reward = newReward;
                updateRewardValue(reward);
            }
        });
    });
});

let context = {
    weekDay: "workweek",
    timeOfDay: "am",
    weather: "sunny",
    userAgent: null,
    useTextAnalytics: false
};

let userAgent = {};

function updateRewardValue(value) {
    const percentageValue = Math.round(value * 100);

    const rewardEle = document.getElementById("reward");
    rewardEle.style = `width: ${percentageValue}%;`;
    rewardEle.setAttribute("aria-valuenow", value);
    rewardEle.innerText = `${value}`;
}

function showRewardMessage(reward) {
    const alertContainerEle = document.getElementById('alert-container');
    alertContainerEle.innerHTML = `<div class="alert alert-success col-12" role="alert">
        Reward of <strong>${reward}</strong> was sent to Personalizer
    </div>`;
}

function clearRewardmessage() {
    const alertContainerEle = document.getElementById('alert-container');
    cleanChilds(alertContainerEle);
}

function setupActionControls() {
    const useTextAnalyticsEle = document.getElementById('text-analytics');
    useTextAnalyticsEle.addEventListener('change', (event) => {
        const checkbox = event.target;
        context.useTextAnalytics = !!checkbox.checked;
        getActions(context.useTextAnalytics).then(updateActionsTab);
    });

    getActions(false).then(updateActionsTab);
}

function setupContextControls() {
    const weekDaySelectEle = document.getElementById('weekDay');
    weekDaySelectEle.addEventListener('change', (event) => {
        updateContext(event.target.value);
    });

    const timeOfDaySelectEle = document.getElementById('timeOfDay');
    timeOfDaySelectEle.addEventListener('change', (event) => {
        updateContext(null, event.target.value);
    });

    const weatherSelectEle = document.getElementById('weather');
    weatherSelectEle.addEventListener('change', (event) => {
        updateContext(null, null, event.target.value);
    });

    const UseUserAgentEle = document.getElementById('use-useragent');
    UseUserAgentEle.addEventListener('change', (event) => {
        const checkbox = event.target;
        if (checkbox.checked) {
            updateContext(null, null, null, false, userAgent);
        } else {
            updateContext(null, null, null, true);
        }
    });

    getUserAgent().then(userAgentResponse => {
        userAgent = userAgentResponse;
        updateContext(weekDaySelectEle.value, timeOfDaySelectEle.value, weatherSelectEle.value, !UseUserAgentEle.checked, userAgent);
    });

    updateContext(weekDaySelectEle.value, timeOfDaySelectEle.value, weatherSelectEle.value);
}

function updateContext(weekDay, timeOfDay, weather, removeUserAgent, userAgent) {
    context.weekDay = weekDay || context.weekDay;
    context.timeOfDay = timeOfDay || context.timeOfDay;
    context.weather = weather || context.weather;
    context.userAgent = removeUserAgent ? null : userAgent || context.userAgent;

    let contextFeatures = [
        {
            weekDay: context.weekDay,
            timeOfDay: context.timeOfDay
        },
        { weather: context.weather }
    ];

    
    if (context.userAgent) {
        contextFeatures.push({ userAgent: context.userAgent });
    }

    updateCodeElementWithJSON("context-code", { contextFeatures: contextFeatures });
}

function updateBasedOnRecommendation(result) {
    showResultContainer();
    updateArticle(result.rewardActionId);
    updateResult(result);
    updatePersonalizerMethod(result);
}

function showResultContainer() {
    const resultAlertEle = document.getElementById("result-alert");
    const resultContainerEle = document.getElementById("result-container");
    resultAlertEle.classList.add("d-none");
    resultContainerEle.classList.remove("d-none");
}

function updatePersonalizerMethod(recommendation) {
    const exploringBoxEle = document.getElementById("exploring-box");
    const exploitingBoxEle = document.getElementById("exploiting-box");

    if (isExploiting(recommendation)) {
        exploitingBoxEle.className = 'card border-left border-primary';
        exploringBoxEle.className = 'card';
    } else {
        exploringBoxEle.className = 'card border-primary';
        exploitingBoxEle.className = 'card';
    }
}

function isExploiting(recommendation) {
    const rewardActionId = recommendation.rewardActionId;
    const ranking = recommendation.ranking;

    let max = Math.max.apply(Math, recommendation.ranking.map((r) => { return r.probability; }));

    for (var i = 0; i < ranking.length; i++) {
        if (ranking[i].id === rewardActionId) {
            return ranking[i].probability === max;
        }
    }
}

function updateResult(result) {
    updateCodeElementWithJSON("result-code", { result: result }, result.rewardActionId);
}

function updateCodeElementWithJSON(eleId, jsonObj, resultId) {
    const codeEle = document.getElementById(eleId);
    let code = JSON.stringify(jsonObj, null, 2);

    if (resultId) {
        const regex = new RegExp(`({\\n.*)("id":\\s"${resultId}",\\n)(.*)("probability.*\\n)(.*})`, 'gm');
        code = code.replace(regex, '$1<mark>$2</mark>$3<mark>$4</mark>$5');
    }

    codeEle.innerHTML = code;
}

function updateActionsTab(actions) {
    const actionsHeaderTab = document.getElementById("actions-tab");
    const actionsTabContent = document.getElementById("actions-tabContent");

    cleanChilds(actionsHeaderTab);
    cleanChilds(actionsTabContent);

    let actionsTabHeadersString = "";
    let actionsTabContentString = "";
    
    for (var i = 0; i < actions.length; i++) {
        let actionTabContent = createActionTab(actions[i], i === 0);
        actionsTabHeadersString += actionTabContent.tabHeader;
        actionsTabContentString += actionTabContent.tabContent;
    }

    actionsHeaderTab.innerHTML = actionsTabHeadersString;
    actionsTabContent.innerHTML = actionsTabContentString;
}

function createActionTab(actionObj, active) {
    let action = {};
    for (var attr in actionObj) {
        if (actionObj.hasOwnProperty(attr) && attr !== "title" && attr !== "imageName") action[attr] = actionObj[attr];
    }

    return {
        tabHeader: `<a class="nav-link d-flex align-items-center${active ? " active" : ""}" id="${actionObj.id}-article-tab" data-toggle="pill" href="#${actionObj.id}-article" role="tab" aria-controls="${actionObj}-article" aria-selected="${active ? "true" : "false"}"> ${actionObj.id}
                        <div class="mx-auto"></div>
                        <img class="rounded img-fluid" alt="Preview thumbnail for ${actionObj.title}" src="img/${actionObj.imageName}" style="max-width:4rem;"></img>
                    </a>`,
        tabContent: `<div class="tab-pane fade ${active ? "show active" : ""}" role="tabpanel" id="${actionObj.id}-article" role="tabpanel" aria-labelledby="${actionObj.id}-article-tab">
                        <p class="h6 p-1 pt-2"><strong>Title:</strong> ${actionObj.title}</p>
                        <pre class="pre-scrollable border m-0"><code>${JSON.stringify(action, null, 2)}</code></pre>
                    </div>`
    };
}

function updateArticle(article) {
    const articleViewer = document.getElementById("article-viewer");
    articleViewer.src = `/home/article/${article}`;
}

function getActions(useTextAnalytics) {
    return fetch(`/api/Metadata/Actions?useTextAnalytics=${useTextAnalytics}`).then(r => r.json());
}

function getRecommendation() {
    const requestContext = {
        weekDay: context.weekDay,
        timeOfDay: context.timeOfDay,
        weather: context.weather,
        useTextAnalytics: context.useTextAnalytics,
        useUserAgent: !!context.userAgent
    };

    return fetch("/api/Personalizer/Recommendation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestContext)
    }).then(r => r.json());
}

function getUserAgent() {
    return fetch("/api/Metadata/UserAgent").then(r => r.json());
}

function sendReward(eventid, value) {
    return fetch("/api/Personalizer/Reward", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            eventid: eventid,
            value: value
        })
    });
}