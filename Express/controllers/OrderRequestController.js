/**
 * 7/1/24 - updated log errors
 */

/*
OrderRequestController.js: handles manipulation of OrderRequests
OrderRequests are individual requests to order a specific part, at a specific quantity.
They can be assigned to Orders, and from there can be marked as ordered.
OrderRequests start as just a request to order an item, and are assigned a specific item
that will be ordered, followed by a specific order they are a part of.
OrderRequests are aware of the order they are assigned to, just as the Order itself is aware what items
it holds. This does not create a circular dependency because mongoose's populate function() is not recursive.
 */

const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const adminMiddleware = require('../middleware/AdminMiddleware');
const bodyParser = require('body-parser');
const Item = require('../models/Item');
const Order = require('../models/Order');
const OrderRequest = require('../models/OrderRequest');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ItemController = require('./ItemController');
const TransactionController = require('./TransactionController');

router.use(bodyParser.json());

/**
 * Removes an order request from a provided order, and removes the order from that order request
 * @param {Order} order order to remove request from
 * @param {OrderRequest} request request to remove
 * @returns updated order
 */
async function removeOrderRequestFromOrder(order, request) {
    // remove the requested request from the array
    order.items = order.items.filter(candidate => {
        if (candidate._id.toString() === request._id.toString()) {
            // Adjust price of order.
            order.total_price -= candidate.itemRef.wholesale_cost * candidate.quantity;
            return false; // item will be removed
        }
        return true;
    });
    await removeOrderFromRequest(request, order);
    const finalOrder = await order.save();
    return finalOrder;
}

/**
 * 
 * @param {Order} order Order to set price for
 * @param {Number} price Price to set on order
 */
async function setOrderPrice(order, price) {
    order.total_price = price;
    const savedOrder = await order.save();
    return savedOrder;
}

/**
 * Helper function to add logs to OrderRequests. MODIFIES input OrderRequest
 * @param item - OrderRequest object from mongoose
 * @param req - http request object
 * @param description - action description
 * @return Promise<OrderRequest> -- transaction with log on it
 */
async function addLogToOrderRequest(item, req, description) {
    const user_id = req.headers['user-id'];
    if (!user_id) throw { error: 'did not find a user-id header' };
    try {
        const user = await User.findById(user_id);
        const action = {
            "employee": user,
            "description": description,
            "time": Date.now()
        };
        // Add this action first in the array
        item.actions.unshift(action);
        return item;
    } catch (e) {
        // Throw the error, we expect caller to handle it
        throw e;
    }
}

// use authMiddleware to require user to login to use any endpoints
router.use(authMiddleware);

/**
 * GET: / - gets all OrderRequests.
 * Possible parameters:
 * status- status string for order requests
 * active- if true, only return order requests that are in cart, or not ordered
 * supplier- string of supplier name
 */
router.get('/', async (req, res) => {
    try {
        let query = {};
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.supplier) {
            query.supplier = req.query.supplier;
        }
        if (req.query.active) {
            query.status = { $in: ["Not Ordered", "In Cart"] };
        }
        const allOrderRequests = await OrderRequest.find(query);
        return res.status(200).json(allOrderRequests);
    } catch (err) {
        console.error('Error fetching order requests: ', err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});


/**
 * GET: /latest/:number - gets latest 'number' OrderRequests.
 * Useful to keep the frontend from having to retrieve the
 * entire order history.
 */
router.get('/latest/:number', async (req, res) => {
    try {
        const allOrderRequests = await OrderRequest.find();
        // Slice the returned array to get only latest requests. Reverse array so newest request is first
        if (allOrderRequests.length < req.params.number) {
            return res.status(200).json(allOrderRequests.reverse());
        } else {
            return res.status(200).json(allOrderRequests
                .slice(allOrderRequests.length - req.params.number, allOrderRequests.length).reverse());
        }
    } catch (err) {
        console.error('Error getting latest number OrderRequests: ', err);
        res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * GET: /distinct-ids: gets all distinct order request IDs
 */
router.get('/distinct-ids', async (req, res) => {
    try {
        const allIDs = await OrderRequest.distinct('_id');
        return res.status(200).json(allIDs);
    } catch (err) {
        console.error('Error getting distinct order request IDs: ', err);
        res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * POST: / - creates new OrderRequest
 *
 * POST body:
 * {
 *     request: string describing the request (required)
 *     quantity: quantity of item requested for order (required)
 *     item_id: ObjectID of Item Document to associate with this order (can be null)
 *     transactions: associated transaction IDs for the request (can be null)
 * }
 */
router.post('/', async (req, res) => {
    try {
        // request validation
        if (req.body.quantity == null) return res.status(400).json({ err: "No item quantity specified", status: 400 });
        if (!req.body.request) return res.status(400).json({ err: "An empty request string was given, or none at all", status: 400 });
        let item;
        if (req.body.item_id) {
            item = await Item.findById(req.body.item_id);
            if (!item) return res.status(404).json({ err: "Item ID specified, but no item found", status: 404 });
        }
        const categories = req.body.categories;
        const quantity = req.body.quantity;
        const request = req.body.request;
        const newOrderReq = await OrderRequest.create({
            itemRef: item,
            request,
            categories,
            quantity
        });
        let transactions = [];
        // Add the order request to transactions
        if (req.body.transactions) {
            for (let transaction of req.body.transactions) {
                let located_transaction = await Transaction.findById(transaction);
                if (!located_transaction) return res.status(404).json({ err: "Transaction ID " + transaction + " given, but no transaction found", status: 404 });
                await TransactionController.addOrderRequestToTransaction(located_transaction, newOrderReq);
                transactions.push(transaction);
            }
        }
        newOrderReq.transactions = transactions;
        const loggedOrderReq = await addLogToOrderRequest(newOrderReq, req, "Created part request");
        const savedOrderReq = await loggedOrderReq.save();
        return res.status(200).json(savedOrderReq);
    } catch (err) {
        if (err.err) {
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        console.error('Error creating new order request: ', err);
        return res.status(500).json(err);
    }
});

/**
 * PUT: /:id/request - updates an OrderRequest's request string
 *
 * PUT body:
 * {
 *     request: new request string
 * }
 */
router.put('/:id/request', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ err: "No matching order request found", status: 404 });
        if (!req.body.request) return res.status(400).json({ err: "Empty or malformed request string", status: 400 });
        const oldDesc = orderRequest.request;
        orderRequest.request = req.body.request;
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, `Changed request description "${oldDesc}" to "${orderRequest.request}"`);
        const finalOrderReq = await loggedOrderReq.save();
        return res.status(200).json(finalOrderReq);
    } catch (err) {
        if (err.err) {
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        console.error('Error updating order request string: ', err);
        res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * PUT: /:id/partnumber - updates an OrderRequest's part number
 *
 * PUT body:
 * {
 *     partNum : new part number
 * }
 */
router.put('/:id/partnumber', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ err: "No matching order request found", status: 404 });
        if (!req.body.partNum == null) return res.status(400).json({ err: "Empty or malformed part number string", status: 400 });
        orderRequest.partNumber = req.body.partNum;
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, "Updated part number to " + orderRequest.partNumber);
        const finalOrderReq = await loggedOrderReq.save();
        return res.status(200).json(finalOrderReq);
    } catch (err) {
        if (err.err) {
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        console.error('Error updating order request part number: ', err);
        res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * PUT: /:id/notes - updates notes on Orderrequest
 *
 * PUT body:
 * {
 *     notes: new notes string
 * }
 */
router.put('/:id/notes', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ err: "No matching order request found", status: 404 });
        if (req.body.notes == null) return res.status(400).json({ err: "Empty or malformed notes string", status: 400 });
        const oldNotes = orderRequest.notes;
        orderRequest.notes = req.body.notes;
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, `Changed notes from "${oldNotes}" to "${req.body.notes}"`);
        const finalOrderReq = await loggedOrderReq.save();
        return res.status(200).json(finalOrderReq);
    } catch (err) {
        console.error('Error updating notes on order request: ', err);
        res.status(500).json({ error: 'Internal server error'});
    }
});


/**
 * PUT: /:id/quantity - update request's quantity
 *
 * PUT body:
 * {
 *   quantity: new quantity for OrderRequest
 * }
 */
router.put("/:id/quantity", async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ err: "No matching order request found", status: 404 });
        if (orderRequest.status == 'Completed') return res.status(400).json({ err: "Cannot change quantity of completed order request", status: 400 });
        if (req.body.quantity == null) return res.status(400).json({ err: "No new quantity specified", status: 400 });
        if (orderRequest.transactions && req.body.quantity < orderRequest.transactions.length) {
            return res.status(400).json({ err: "Cannot set quantity below number of attached transactions", status: 400 });
        }
        if (orderRequest.orderRef) {
            // Update price of the order
            let order = await Order.findById(orderRequest.orderRef);
            let newPrice = order.total_price + orderRequest.itemRef.wholesale_cost * (req.body.quantity - orderRequest.quantity);
            await setOrderPrice(order, newPrice);
        }
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req,
            `Changed quantity from ${orderRequest.quantity} to ${req.body.quantity}`);
        loggedOrderReq.quantity = req.body.quantity;
        const finalOrderReq = await loggedOrderReq.save();
        return res.status(200).json(finalOrderReq);
    } catch (err) {
        console.error('Error getting distinct order request IDs: ', err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * PUT: /:id/status - update request's status to complete
 */
router.put('/:id/status', async (req, res) => {
    try {
        if (!req.body.status) return res.status(400).json({ erro: "No status specified", status: 400 });
        const orderRequest = await OrderRequest.findById(req.body.id);
        if (!orderRequest) return res.status(404).json({ err: "No matching order request found", status: 404 });
        const updated = await setRequestStatus(orderRequest, req.body.status, req);
        const complete = await updated.save();

        return res.status(200).json(complete);
    } catch (err) {
        console.error("Error updating request's status to complete: ", err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * POST /:id/transaction - add a transaction to an order request.
 * Transaction IDs can be added multiple times to one order request 
 * (symbolizes the transaction needing multiple of requested item)
 * 
 * This endpoint will update the order request, and will add the 
 * order request to the transaction itself.
 * 
 * POST body:
 * {
 *     transaction_id: ID of transaction to add.
 * }
 */
router.post('/:id/transaction', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ "err": "no matching order request found", status: 404 });
        if (!req.body.transaction_id) return res.status(400).json({ "err": "no transaction id provided", status: 400 });
        let transaction = await Transaction.findById(req.body.transaction_id);
        if (!transaction) return res.status(404).json({ "err": "no matching transaction found", status: 404 });
        // Do not allow users to add order requests to completed transactions.
        if (transaction.complete) return res.status(400).json({ "err": "cannot add order request to completed transaction", status: 400 });
        if (orderRequest.status == 'Complete') return res.status(400).json({ "err": "cannot add completed order request to transaction", status: 400 });
        // Now, add the transaction to the order request and vice versa
        transaction = await TransactionController.addOrderRequestToTransaction(transaction, orderRequest);
        orderRequest.transactions.push(transaction._id);
        // Add to order request quantity, and update order price if required.
        orderRequest.quantity += 1;
        if (orderRequest.orderRef && orderRequest.itemRef) {
            const order = await Order.findById(orderRequest.orderRef);
            let total_price = order.total_price + orderRequest.itemRef.wholesale_cost;
            await setOrderPrice(order, total_price);
        }
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, `Added transaction ${transaction._id}`);
        const savedOrderReq = await loggedOrderReq.save();
        return res.status(200).json(savedOrderReq);
    } catch (err) {
        if (err.err) {
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        console.error('Error adding transaction to order request: ', err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * Deletes an order request from the database. 
 * Automatically handles removing order request reference from transactions, as well as orders.
 * @param {OrderRequest} orderRequest Request to delete
 */
async function deleteOrderRequest(orderRequest) {
    if (orderRequest.orderRef) {
        // Get reference to order this request is in, and update cost.
        let order = await Order.findById(orderRequest.orderRef);
        let item = await Item.findById(orderRequest.itemRef);
        let total_price = order.total_price - item.wholesale_cost * orderRequest.quantity;
        order = await setOrderPrice(order, total_price);
        // Remove orderRequest from order.
        await removeOrderRequestFromOrder(order, orderRequest);
    }
    /**
     * Special case here: up until this point in the lifecycle of an order request, we try to keep the
     * transactions' references to an order request in sync with the order request's reference to
     * the transactions. Once the order is completed however, we want to keep the transaction numbers for
     * future reference, but we do not want transactions to be "waiting on part", so we let the relationship
     * lapse. The transaction will no longer have a reference to the order request, but the order request
     * will have a reference to the transaction.
     */
    if (orderRequest.status != 'Completed') {
        // Remove orderRequest from transactions
        for (let transaction of orderRequest.transactions) {
            let transactionRef = await Transaction.findById(transaction);
            await TransactionController.removeOrderRequestFromTransaction(transactionRef, orderRequest);
        }
    }
    await orderRequest.remove();
}

/**
 * 
 * @param {OrderRequest} request Request to set supplier for
 * @param {String} supplier string to set for supplier
 */
async function setSupplier(request, supplier) {
    request.supplier = supplier;
    const savedReq = await request.save();
    return savedReq;
}

/**
 * DELETE /:id/transaction/transactionID - removes a transaction from an order request by its ID
 * 
 * Will also update the transaction to remove the order request.
 * If an order request has a transaction associated multiple times, this endpoint will only remove it once.
 */
router.delete('/:id/transaction/:transactionID', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ "err": "no matching order request found", status: 404 });
        const transaction = await Transaction.findById(req.params.transactionID);
        if (!transaction) return res.status(404).json({ "err": "no matching transaction found", status: 404 });
        // Now remove the transaction from the order request and vice versa
        let index = orderRequest.transactions.indexOf(transaction._id);
        if (index == -1) return res.status(404).json({ "err": "transaction was not found attached to order request", status: 404 });
        orderRequest.transactions.splice(index, 1);
        // Decrease order request quantity, and update order price if required.
        orderRequest.quantity -= 1;
        if (orderRequest.orderRef && orderRequest.itemRef) {
            const order = await Order.findById(orderRequest.orderRef);
            const total_price = order.total_price - orderRequest.itemRef.wholesale_cost;
            await setOrderPrice(order, total_price);
        }
        await TransactionController.removeOrderRequestFromTransaction(transaction, orderRequest);
        if (orderRequest.quantity == 0) {
            // All transactions have been removed from the order request, and we can assume that the request is not useful now. Delete it.
            await deleteOrderRequest(orderRequest);
            return res.status(204).json({}); // We have deleted order request, so no way to send it.
        }
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req, `Removed transaction ${transaction._id}`);
        const savedOrderReq = await loggedOrderReq.save();
        return res.status(200).json(savedOrderReq);
    } catch (err) {
        if (err.err) {
            let status = 500;
            if (err.status) status = err.status;
            return res.status(status).json({ err: err.err, status: status });
        }
        console.error('Error removing transaction from order request: ', err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});

/**
 * Moves order request from a request into an actual item on provided transactions. Deletes the reference to
 * the order request, and adds the item. Effectively "fulfills" the order request.
 * @param {OrderRequest} requestRef: Order request to fulfill on transactions
 * @param {number[]} transactions: transactions to add item to. One of the item associated to the request will be added to each transaction in the array
 *                                  (so if a transaction appears twice, two items will be added)
 * @param {Object} req: http request containnig user ID
 */
async function fulfillTransactionsOrderRequest(requestRef, transactions, req = null) {
    // not using try/catch because we want errors to be caught by callers
    if (!requestRef) {
        throw { err: "Could not locate order request to fulfill", status: 404 };
    }
    const itemRef = await Item.findById(requestRef.itemRef._id);
    if (!itemRef) {
        // throw error so the frontend knows something went wrong
        throw { err: "Could not locate item to add to transaction", status: 404 };
    }
    for (let transaction_id of transactions) {
        let transactionRef = await Transaction.findById(transaction_id);
        if (!transactionRef) {
            throw { err: "Could not find transaction to add item to", status: 404 };
        }
        // add log to transaction
        await TransactionController.addLogToTransaction(transactionRef, req, `Added ${requestRef.request} from completed Whiteboard Request`)
        transactionRef = await TransactionController.addItemToTransaction(transactionRef, itemRef);
        /**
         * Note that we do not update the order request here. Once an order request is completed, the relationship between the
         * transaction's orderRequests field and the order request's transactions field can break, and will.
         */
        transactionRef = await TransactionController.removeOrderRequestFromTransaction(transactionRef, requestRef);
        await transactionRef.save()
    }
}

/**
 * Moves actual item on provided transactions back to an order request. Deletes the reference to
 * the item. Effectively "unfulfills" the order request.
 * @param {OrderRequest} requestRef: ID of order request to unfulfill on transactions
 * @param {number[]} transactions: transactions to add item to. One of the item associated to the request will be added to each transaction in the array
 *                                  (so if a transaction appears twice, two items will be added)
 */
async function unfulfillTransactionsOrderRequest(requestRef, transactions) {
    // not using try/catch because we want errors to be caught by callers
    if (!requestRef) {
        throw { err: "Could not locate order request to add to transaction", status: 404 }
    }
    const itemRef = await Item.findById(requestRef.itemRef._id);
    if (!itemRef) {
        // throw error so the frontend knows something went wrong
        throw { err: "Could not locate item to remove from transaction", status: 404 };
    }
    let completedTransactions = []
    for (let [index, transaction_id] of transactions.entries()) {
        const transactionRef = await Transaction.findById(transaction_id)
        if (!transactionRef) {
            if (requestRef.status == 'Completed') {
                /**
                 * Transaction was deleted, and it did not have a reference to the order request so this request was not modified.
                 * Silently remove the transaction
                 */
                requestRef.transactions.splice(index, 1);
                transactions.splice(index, 1);
            } else {
                throw { err: "Could not find transaction to add item to", status: 404 };
            }
        } else {
            if (transactionRef.complete) {
                completedTransactions.push(transaction_id);
            }
        }
    }
    if (completedTransactions.length > 0) {
        /**
         * We can't unfulfill the order request. This is because some transactions it refers to are completed, so they cannot be waiting on parts.
         * This means the parts in the order request have been at least partially used.
         */
        throw { err: "Cannot unfulfill order request, since some attached transactions are complete", status: 400, problemTransactions: completedTransactions };
    }
    for (let transaction_id of transactions) {
        let transactionRef = await Transaction.findById(transaction_id);
        // Remove item from transaction
        transactionRef = await TransactionController.removeItemFromTransaction(transactionRef, itemRef);
        /**
         * Note that we do not update the order request here. Once an order request is completed, the relationship between the
         * transaction's orderRequests field and the order request's transactions field can break, and will.
         */
        transactionRef = await TransactionController.addOrderRequestToTransaction(transactionRef, requestRef);
        await transactionRef.save()
    }
}

/**
 * Updates the status of an order request. DOES NOT save the order request
 * If the request is marked as complete (or marked as incomplete when it previously was completed), 
 * this function will also edit the stock of any attached items, as well as update transactions attached to the request
 * @param {OrderRequest} orderRequest Order request to set status for
 * @param {string} status Order request status
 * @param {Object} req http request object
 */
async function setRequestStatus(orderRequest, status, req = null) {
    if (orderRequest.status != 'Completed' && status == 'Completed') {
        /**
         * Need to update stock of attached item, as well as add the item to
         * any transactions waiting for it to arrive
         */
        orderRequest.status = status;
        orderRequest = await orderRequest.save();
        await ItemController.increaseItemStock(orderRequest.itemRef._id, orderRequest.quantity);
        await fulfillTransactionsOrderRequest(orderRequest, orderRequest.transactions, req);
    } else if (orderRequest.status == 'Completed' && status != 'Completed') {
        // First try to unfurfill order requests as this may fail.
        await unfulfillTransactionsOrderRequest(orderRequest, orderRequest.transactions);
        /**
         * Need to update stock of attached item, as well as add the order request back to
         * any transactions waiting for it to arrive
         */
        orderRequest.status = status;
        /**
         * Save the request before dropping item stock. 
         * Otherwise item control might create a new duplicate order request
         */
        orderRequest = await orderRequest.save();
        await ItemController.decreaseItemStock(orderRequest.itemRef._id, orderRequest.quantity);
    } else {
        orderRequest.status = status;
    }
    return orderRequest;
}

/**
 * Adds an order to an order request
 * @param {OrderRequest} request to add order to
 * @param {Order} order order to add to request
 */
async function addOrderToOrderRequest(request, order) {
    request.orderRef = order._id;
    request = await setRequestStatus(request, order.status);
    request.supplier = order.supplier;
    const savedRequest = await request.save();
    return savedRequest;
}

/**
 * Removes an order from an order request
 * @param {OrderRequest} request to add order to
 * @param {Order} order order to add to request
 */
async function removeOrderFromRequest(request, order) {
    request.orderRef = null;
    request = await setRequestStatus(request, 'Not Ordered');
    request.supplier = null;
    const savedRequest = await request.save();
    return savedRequest;
}

/**
 * DELETE: /:id - deletes an OrderRequest by its ID
 */
router.delete('/:id', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ err: "No matching order request found", status: 404 });
        await deleteOrderRequest(orderRequest);
        return res.status(200).json({ status: "OK" });
    } catch (err) {
        console.error('Error deleting order request by ID: ', err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});


// All endpoints below here require an admin login.
router.use(adminMiddleware);

/**
 * PUT /:id/item - associates an Item with an OrderRequest
 *
 * PUT Body:
 * {
 *     item_id: ObjectID of item to associate with the OrderRequest
 * }
 */
router.put('/:id/item', async (req, res) => {
    try {
        const orderRequest = await OrderRequest.findById(req.params.id);
        if (!orderRequest) return res.status(404).json({ err: "No matching order request found", status: 404 });
        if (orderRequest.status == 'Completed') return res.status(400).json({ err: "Cannot change item on completed order request", status: 400 });
        if (!req.body.item_id) return res.status(400).json({ err: "No item ID provided to add to order request", status: 400 });
        const locatedItem = await Item.findById(req.body.item_id);
        if (!locatedItem) return res.status(404).json({ err: "No item located matching the ID specified", status: 404 });
        if (orderRequest.orderRef) {
            // We need to update the order's cost to match this new item.
            const order = await Order.findById(orderRequest.orderRef);
            order.total_price += (locatedItem.wholesale_cost - orderRequest.itemRef.wholesale_cost) * orderRequest.quantity;
            await order.save();
        }
        orderRequest.itemRef = locatedItem._id;
        let categories;
        if (locatedItem.category_1) {
            categories = [locatedItem.category_1, null, null];
            if (locatedItem.category_2) {
                categories[1] = locatedItem.category_2;
                if (locatedItem.category_3) categories[2] = locatedItem.category_3;
            };
        }
        else {
            categories = [locatedItem.category]
        }
        orderRequest.categories = categories;
        orderRequest.request = locatedItem.name;
        const loggedOrderReq = await addLogToOrderRequest(orderRequest, req,
            `Assigned item ${locatedItem.name} to request`);
        const finalOrderReq = await loggedOrderReq.save();
        const populatedOrderReq = await OrderRequest.findById(loggedOrderReq._id);
        return res.status(200).json(populatedOrderReq);
    } catch (err) {
        console.error('Error associating item with order request: ', err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});




module.exports = {
    router: router,
    addLogToOrderRequest: addLogToOrderRequest,
    addOrderToOrderRequest: addOrderToOrderRequest,
    removeOrderFromRequest: removeOrderFromRequest,
    setRequestStatus: setRequestStatus,
    setSupplier: setSupplier,
    // These functions are housed here to avoid circular dependency
    setOrderPrice: setOrderPrice,
    removeOrderRequestFromOrder: removeOrderRequestFromOrder
};
