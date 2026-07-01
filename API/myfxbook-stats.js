const MYFXBOOK_API = 'https://www.myfxbook.com/api';

function sendJson(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.setHeader('CDN-Cache-Control', 'no-store');
    response.setHeader('Surrogate-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.end(JSON.stringify(payload));
}

async function requestJson(url) {
    const requestUrl = new URL(url);
    requestUrl.searchParams.set('_', String(Date.now()));

    const response = await fetch(requestUrl, {
        cache: 'no-store',
        headers: {
            accept: 'application/json',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
            'user-agent': 'TheForexBank/1.0 live dashboard'
        }
    });
    if (!response.ok) {
        throw new Error(`Myfxbook request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data?.error) {
        throw new Error(data.message || 'Myfxbook returned an error');
    }

    return data;
}

function findAccount(accounts, configuredId, configuredName) {
    if (!Array.isArray(accounts) || !accounts.length) return null;

    if (configuredId) {
        const id = String(configuredId).trim();
        const match = accounts.find((account) => (
            String(account.id) === id ||
            String(account.accountId) === id
        ));
        if (match) return match;
    }

    if (configuredName) {
        const name = String(configuredName).trim().toLowerCase();
        const match = accounts.find((account) => String(account.name || '').trim().toLowerCase() === name);
        if (match) return match;
    }

    return accounts[0];
}

function formatDateInput(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function flattenDailyData(dataDaily) {
    if (!Array.isArray(dataDaily)) return [];
    return dataDaily.flatMap((item) => Array.isArray(item) ? item : [item]).filter(Boolean);
}

module.exports = async function handler(request, response) {
    if (request.method === 'OPTIONS') {
        response.statusCode = 204;
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Cache-Control, Pragma');
        response.end();
        return;
    }

    if (request.method && request.method !== 'GET') {
        sendJson(response, 405, { error: true, message: 'Method not allowed' });
        return;
    }

    const email = process.env.MYFXBOOK_EMAIL;
    const password = process.env.MYFXBOOK_PASSWORD;
    const accountId = process.env.MYFXBOOK_ACCOUNT_ID || '12096259';
    const accountName = process.env.MYFXBOOK_ACCOUNT_NAME;

    if (!email || !password) {
        sendJson(response, 500, {
            error: true,
            message: 'Missing MYFXBOOK_EMAIL or MYFXBOOK_PASSWORD environment variable.'
        });
        return;
    }

    let session = '';

    try {
        const loginUrl = `${MYFXBOOK_API}/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
        const loginData = await requestJson(loginUrl);
        session = loginData.session;

        if (!session) {
            throw new Error('Myfxbook login did not return a session.');
        }

        const accountsUrl = `${MYFXBOOK_API}/get-my-accounts.json?session=${session}`;
        const accountsData = await requestJson(accountsUrl);
        const account = findAccount(accountsData.accounts, accountId, accountName);

        if (!account) {
            throw new Error('Configured Myfxbook account was not found.');
        }

        let openTrades = account.openTrades;
        let todayProfit = null;
        try {
            const openTradesUrl = `${MYFXBOOK_API}/get-open-trades.json?session=${session}&id=${encodeURIComponent(account.id)}`;
            const openTradesData = await requestJson(openTradesUrl);
            openTrades = Array.isArray(openTradesData.openTrades) ? openTradesData.openTrades.length : openTrades;
        } catch (error) {
            openTrades = openTrades ?? null;
        }

        try {
            const now = new Date();
            const start = formatDateInput(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
            const end = formatDateInput(new Date(now.getTime() + 24 * 60 * 60 * 1000));
            const dailyDataUrl = `${MYFXBOOK_API}/get-data-daily.json?session=${session}&id=${encodeURIComponent(account.id)}&start=${start}&end=${end}`;
            const dailyData = await requestJson(dailyDataUrl);
            const days = flattenDailyData(dailyData.dataDaily);
            const latestDay = days[days.length - 1];
            todayProfit = latestDay?.profit ?? null;
        } catch (error) {
            todayProfit = null;
        }

        sendJson(response, 200, {
            error: false,
            id: account.id,
            accountId: account.accountId,
            name: account.name,
            currency: account.currency || 'USD',
            gain: account.gain,
            absGain: account.absGain,
            daily: account.daily,
            monthly: account.monthly,
            drawdown: account.drawdown,
            balance: account.balance,
            equity: account.equity,
            profit: account.profit,
            todayProfit,
            openTrades,
            lastUpdateDate: account.lastUpdateDate,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        sendJson(response, 500, {
            error: true,
            message: error.message || 'Myfxbook stats unavailable.'
        });
    } finally {
        if (session) {
            const logoutUrl = `${MYFXBOOK_API}/logout.json?session=${session}`;
            fetch(logoutUrl).catch(() => {});
        }
    }
};
