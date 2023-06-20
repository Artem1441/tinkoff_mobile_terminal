import axios from "axios";
import { Helpers } from "tinkoff-invest-api";
import { ApiAddOrder, ApiCancelOrder, ApiGetCandles, ApiGetOrders, ApiGetPortfolio, ApiGetAccounts, ApiGetTradeStatus, ApiGetShareInfo, ApiGetLastCandle, ApiGetOrderbook } from "../core/operations.js";
import shares from "../data/SHARES.json" assert { "type": "json" }

class InfoController {
    async TestToken(req, res) {
        const { token } = req.body
        try {
            const accounts = await ApiGetAccounts({ token })
            const accountId = accounts[0].id

            return res.send({ status: true, message: null, result: accountId }) // success
        } catch (err) {
            return res.send({ status: false, message: "Упс... что-то пошло не так. Возможно токен введён неправильно, а может и вовсе устарел", result: null }) // error
        }
    }

    async GetStocks(req, res) {
        try {
            const stocks = []
            for (const [key] of Object.entries(shares)) {
                const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const dayFrom = dateFrom.getDate();
                const monthFrom = dateFrom.getMonth() + 1;
                const yearFrom = dateFrom.getFullYear();
                const dateTo = new Date(Date.now());
                const dayTo = dateTo.getDate();
                const monthTo = dateTo.getMonth() + 1;
                const yearTo = dateTo.getFullYear();

                const stockCandles = await axios(`https://iss.moex.com/iss/engines/stock/markets/shares/securities/${key}/candles.json?interval=24&from=${yearFrom}-${monthFrom}-${dayFrom}&till=${yearTo}-${monthTo}-${dayTo}&limit=1`).then((res) => {
                    return res.data.candles.data[res.data.candles.data.length - 1]
                })
                shares[key].ticker = key
                shares[key].open = stockCandles[0]
                shares[key].close = stockCandles[1]

                stocks.push(shares[key])
            }

            return res.send(stocks) // success
        } catch (err) {
            return res.send("Ошибка при получении данных с мосбиржи") // error
        }
    }

    async GetStocksJSON(req, res) {
        try {
            return res.send(shares) // success
        } catch (err) {
            return res.send("Ошибка при получении данных с мосбиржи") // error
        }
    }

    async GetPortfolio(req, res) {
        try {
            const { token, accountId } = req.body
            if (!token) {
                res.send({ status: false, message: "Упс... что-то полшо не так", result: err.message }) // error
                return
            }

            const portfolio = await ApiGetPortfolio({ token, accountId })

            portfolio.expectedYield = Helpers.toNumber(portfolio.expectedYield)
            portfolio.totalAmountBonds = Helpers.toNumber(portfolio.totalAmountBonds)
            portfolio.totalAmountCurrencies = Helpers.toNumber(portfolio.totalAmountCurrencies)
            portfolio.totalAmountEtf = Helpers.toNumber(portfolio.totalAmountEtf)
            portfolio.totalAmountFutures = Helpers.toNumber(portfolio.totalAmountFutures)
            portfolio.totalAmountShares = Helpers.toNumber(portfolio.totalAmountShares)

            portfolio.positions = portfolio.positions.map((item) => {
                return {
                    ...item,
                    quantity: Helpers.toNumber(item.quantity),
                    averagePositionPrice: Helpers.toNumber(item.averagePositionPrice),
                    expectedYield: Helpers.toNumber(item.expectedYield),
                    averagePositionPricePt: Helpers.toNumber(item.averagePositionPricePt),
                    currentPrice: Helpers.toNumber(item.currentPrice),
                    averagePositionPriceFifo: Helpers.toNumber(item.averagePositionPriceFifo),
                    quantityLots: Helpers.toNumber(item.quantityLots),
                }
            })



            return res.send({ status: true, message: null, result: portfolio }) // success
        } catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при получени портфеля.`, result: err.message }) // error
        }
    }

    async GetCandles(req, res) {
        try {
            const { token, ticker } = req.body
            const figi = shares[ticker].figi
            let candles = await ApiGetCandles({ token, figi })
            if (candles.length > 50) candles = candles.slice(candles.length - 50)
            const candlesArr = []
            candles.forEach(candle => {
                candlesArr.push({
                    open: Helpers.toNumber(candle.open),
                    close: Helpers.toNumber(candle.close),
                    high: Helpers.toNumber(candle.high),
                    low: Helpers.toNumber(candle.low),
                    time: candle.time
                })
            })

            return res.send({ status: true, message: null, result: candlesArr }) // success
        } catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при получени свеч.`, result: err.message }) // error
        }
    }

    async GetOrders(req, res) {
        try {
            const { token, accountId } = req.body
            const orders = await ApiGetOrders({ token, accountId })
            const ordersArr = []
            orders.forEach(order => {
                let ticker
                for (const [key] of Object.entries(shares)) if (shares[key].figi === order.figi) ticker = key

                if (ticker) ordersArr.push({
                    ...order,
                    ticker,
                    initialOrderPrice: Helpers.toNumber(order.initialOrderPrice),
                    executedOrderPrice: Helpers.toNumber(order.executedOrderPrice),
                    totalOrderAmount: Helpers.toNumber(order.totalOrderAmount),
                    averagePositionPrice: Helpers.toNumber(order.averagePositionPrice),
                    initialCommission: Helpers.toNumber(order.initialCommission),
                    executedCommission: Helpers.toNumber(order.executedCommission),
                    initialSecurityPrice: Helpers.toNumber(order.initialSecurityPrice),
                    serviceCommission: Helpers.toNumber(order.serviceCommission),
                })
            })

            return res.send({ status: true, message: null, result: ordersArr }) // success
        } catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при получени заявок.`, result: err.message }) // error
        }
    }

    async CancelOrder(req, res) {
        try {
            const { token, accountId, orderId } = req.body
            await ApiCancelOrder({ token, accountId, orderId })

            return res.send({ status: true, message: null, result: null }) // success
        } catch (err) {
            console.log(err)
            return res.send({ status: false, message: `Что-то пошло не так при отмене заявки.`, result: err.message }) // error
        }
    }

    async AddOrder(req, res) {
        try {
            const { token, accountId, ticker, quantity, price, direction } = req.body
            const { figi } = shares[ticker]
            await ApiAddOrder({ token, accountId, figi, quantity, price, direction })

            return res.send({ status: true, message: null, result: null }) // success
        } catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при создании заявки.`, result: err.message }) // error
        }
    }

    async IsOpenMarketForStock(req, res) {
        try {
            const { token, ticker } = req.body
            const { figi } = shares[ticker]
            const tradingStatus = await ApiGetTradeStatus({ token, figi })

            return res.send({ status: true, message: null, result: tradingStatus.tradingStatus }) // success
        } catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при получени данных о рынке.`, result: err.message }) // error
        }
    }

    async GetShareInfo(req, res) {
        try {
            const { token, ticker } = req.body
            const shareInfoCopy = await ApiGetShareInfo({ token, ticker })
            const shareInfo = {
                minPriceIncrement: Helpers.toNumber(shareInfoCopy.minPriceIncrement),
                lot: shareInfoCopy.lot,
                buyAvailableFlag: shareInfoCopy.buyAvailableFlag,
                sellAvailableFlag: shareInfoCopy.sellAvailableFlag,
            }

            return res.send({ status: true, message: null, result: shareInfo }) // success
        } catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при получении данных о компании.`, result: err.message }) // error
        }
    }

    async GetLastCandle(req, res) {
        try {
            const { token, ticker } = req.body
            const { figi } = shares[ticker]
            const lastCandle = await ApiGetLastCandle({ token, figi })
            return res.send({
                status: true, message: null, result: {
                    open: Helpers.toNumber(lastCandle.open),
                    close: Helpers.toNumber(lastCandle.close),
                    high: Helpers.toNumber(lastCandle.high),
                    low: Helpers.toNumber(lastCandle.low),
                    time: lastCandle.time
                }
            }) // success
        }
        catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при получении свечи.`, result: err.message }) // error
        }
    }

    async GetOrderbook(req, res) {
        try {
            const { token, ticker } = req.body
            const { figi } = shares[ticker]
            const orderbook = await ApiGetOrderbook({ token, figi })
            return res.send({ status: true, message: null, result: orderbook }) // success
        } catch (err) {
            return res.send({ status: false, message: `Что-то пошло не так при получении стакана.`, result: err.message }) // error
        }
    }
}

export default new InfoController()

// "RUB": {
//     "name": "Рубль",
//     "img": "https://invest-brands.cdn-tinkoff.ru/sber3x160.png",
//     "figi": "RUB000UTSTOM"
// }

//  Доллар BBG0013HGFT4
// {
//   figi: 'BBG004730N88',
//   ticker: 'SBER',
//   classCode: 'TQBR',
//   isin: 'RU0009029540',
//   lot: 10,
//   currency: 'rub',
//   klong: { units: 2, nano: 0 },
//   kshort: { units: 2, nano: 0 },
//   dlong: { units: 0, nano: 200000000 },
//   dshort: { units: 0, nano: 199900000 },
//   dlongMin: { units: 0, nano: 105600000 },
//   dshortMin: { units: 0, nano: 95400000 },
//   shortEnabledFlag: true,
//   name: 'Сбер Банк',
//   exchange: 'MOEX_EVENING_WEEKEND',
//   ipoDate: 2007-07-11T00:00:00.000Z,
//   issueSize: 21586948000,
//   countryOfRisk: 'RU',
//   countryOfRiskName: 'Российская Федерация',
//   sector: 'financial',
//   issueSizePlan: 21586948000,
//   nominal: { currency: 'rub', units: 3, nano: 0 },
//   tradingStatus: 5,
//   otcFlag: false,
//   buyAvailableFlag: true,
//   sellAvailableFlag: true,
//   divYieldFlag: true,
//   shareType: 1,
//   minPriceIncrement: { units: 0, nano: 10000000 },
//   apiTradeAvailableFlag: true,
//   uid: 'e6123145-9665-43e0-8413-cd61b8aa9b13',
//   realExchange: 1,
//   positionUid: '41eb2102-5333-4713-bf15-72b204c4bf7b',
//   forIisFlag: true,
//   first1minCandleDate: 2018-03-07T18:33:00.000Z,
//   first1dayCandleDate: 2000-01-04T07:00:00.000Z
// }