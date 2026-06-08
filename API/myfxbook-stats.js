const MYFXBOOK_API = 'https://www.myfxbook.com/api';

function sendJson(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.end(JSON.stringify(payload));
}

async function requestJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
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

module.exports = async function handler(request, response) {
    if (request.method && request.method !== 'GET') {
        sendJson(response, 405, { error: true, message: 'Method not allowed' });
        return;
    }

    const email = process.env.MYFXBOOK_EMAIL;
    const password = process.env.MYFXBOOK_PASSWORD;
    const accountId = process.env.MYFXBOOK_ACCOUNT_ID || '12049136';
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

        const accountsUrl = `${MYFXBOOK_API}/get-my-accounts.json?session=${encodeURIComponent(session)}`;
        const accountsData = await requestJson(accountsUrl);
        const account = findAccount(accountsData.accounts, accountId, accountName);

        if (!account) {
            throw new Error('Configured Myfxbook account was not found.');
        }

        let openTrades = account.openTrades;
        try {
            const openTradesUrl = `${MYFXBOOK_API}/get-open-trades.json?session=${encodeURIComponent(session)}&id=${encodeURIComponent(account.id)}`;
            const openTradesData = await requestJson(openTradesUrl);
            openTrades = Array.isArray(openTradesData.openTrades) ? openTradesData.openTrades.length : openTrades;
        } catch (error) {
            openTrades = openTrades ?? null;
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
            openTrades,
            lastUpdateDate: account.lastUpdateDate
        });
    } catch (error) {
        sendJson(response, 500, {
            error: true,
            message: error.message || 'Myfxbook stats unavailable.'
        });
    } finally {
        if (session) {
            const logoutUrl = `${MYFXBOOK_API}/logout.json?session=${encodeURIComponent(session)}`;
            fetch(logoutUrl).catch(() => {});
        }
    }
};
