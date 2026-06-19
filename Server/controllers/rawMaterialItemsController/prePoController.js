const prisma = require("../../config/prismaClient");

const getPrePoRequest = async (req, res) => {
    try {

        let prePo = await prisma.prePo.findMany({
            where: {
                prePO_CreatedBy
            },
            include: { prePoItems: true }
        })

        return res.status(200).json({ success: true, data: prePo });


    } catch (er) {
        return res.status(500).json({ success: false, message: "Internal Server Error.", error: er?.message });
    }
}

const createPrePoRequest = async (req, res) => {
    try {
        let { items, vendorId } = req.body;

        if (!Array.isArray(items) || items.length === 0)
            return res.status(400).json({ success: false, message: "Items are required." });

        if (!vendorId) return res.status(400).json({ success: false, message: 'Required Field missing.' });

        // checking vendor exist or not
        let vendor = await prisma.vendor.findFirst({
            where: {
                id: vendorId
            }
        })

        if (!vendor) return res.status(400).json({ success: false, message: "Vendor with this id not found." });


        const itemsIds = items.map(i => i.itemId);

        //  checking ,that if items exist or not
        const existingItems = await prisma.purchaseOrderItem.findMany({
            where: {
                id: {
                    in: itemsIds
                }
            },
            select: {
                id: true
            }
        })

        const existId = new Set(existingItems.map(i => i.id))

        if (itemsId.length !== existId.length) return res.status(400).json({ success: false, message: 'Some Items do not exist' });

        const createPrePo = await prisma.prePo.create({
            vendorId,
            prePO_CreatedBy //need to add user id here
        })

        const addItem = await prisma.prePoItems.createMany({
            data: items.map(i => ({
                prePoId: createPrePo.id,
                itemId: i.itemId,
                itemSource: i.itemSource,
                itemName: i.itemName,
                quantity: i.quantity,
                rate: i.rate,
                unit: i.unit
            }))
        })


        return res.status(201).json({ success: true, message: 'Request Created Successfully' });



    } catch (er) {
        return res.status(500).json({ success: false, message: "Internal Server Error", error: er?.message });
    }
}

module.exports = {
    createPrePoRequest,
    getPrePoRequest
};