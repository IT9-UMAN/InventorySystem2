const prisma = require("../../config/prismaClient");



const getPrePoRequest = async (req, res) => {
    try {

        let { role } = req.user;

        if (role.name === 'PrePurchase') {

            let prePo = await prisma.prePo.findMany({
                where: {
                    createdBy: req.user.id
                },
                include: { prePoItems: true }
            })

            return res.status(200).json({ success: true, data: prePo });
        }
        else if (role.name === 'Purchase') {
            let prePo = await prisma.prePo.findMany({
                where: {
                    status: {
                        not: 'PREPO_DRAFT'
                    }
                },
                include: { prePoItems: true }
            })
            return res.status(200).json({ success: true, data: prePo });
        }

        return res.status(400).json({ success: false, message: "You are accessing the wrong API.." })


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
        let vendor = await prisma.vendor.findUnique({
            where: {
                id: vendorId
            }
        })

        if (!vendor) return res.status(400).json({ success: false, message: "Vendor with this id not found." });


        const uniqueItemIds = [...new Set(items.map(i => i.itemId))];

        //  checking ,that if items exist or not
        const existingItems = await prisma.rawMaterial.findMany({
            where: {
                id: {
                    in: uniqueItemIds
                }
            },
            select: {
                id: true
            }
        })

        if (uniqueItemIds.length !== existingItems.length) return res.status(400).json({ success: false, message: 'Some Items do not exist' });


        let prePo = await prisma.$transaction(async (tx) => {
            const createPrePo = await tx.prePo.create({
                data: {
                    vendorId,
                    createdBy: req.user.id
                }
            })

            await tx.prePoItems.createMany({
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

            return await tx.prePo.findUnique({
                where: {
                    id: createPrePo.id
                },
                include: {
                    prePoItems: true
                }
            });
        });

        return res.status(201).json({ success: true, message: 'Request created Successfully.', data: prePo });

    } catch (er) {
        return res.status(500).json({ success: false, message: "Internal Server Error", error: er?.message });
    }
}

const changeRequestStatus = async (req, res) => {
    try {
        let { prePoId } = req.params;
        let { status } = req.body;
        
        let { role } = req.user;

        const validStatus = [
            'PREPO_DRAFT',
            'PREPO_REQUESTED',
            'PREPO_APPROVED',
            'PREPO_REJECTED',
            'PO_GENERATED'
        ];

        if (!validStatus.includes(status.toUpperCase())) return res.status(400).json({ success: false, message: "Invalid status" });

        if (!['PrePurchase', 'Purchase'].includes(role.name)) return res.status(403).json({ success: false, message: "You dont have permission." });


        if (role.name === 'PrePurchase' && ['PREPO_APPROVED', 'PREPO_REJECTED', 'PREPO_DRAFT', 'PO_GENERATED'].includes(status.toUpperCase()))

            return res.status(403).json({ success: false, message: "You dont have permission to do that." });


        if (role.name === 'Purchase' && ['PREPO_DRAFT', 'PREPO_REQUESTED', 'PO_GENERATED'].includes(status))

            return res.status(403).json({ success: false, message: "You dont have permission to do that." });


        if (!prePoId) return res.status(400).json({ success: false, message: "Id not found" })

        let prePo = await prisma.prePo.findUnique({
            where: {
                id: prePoId
            },
        });

        if (!prePo) return res.status(400).json({ success: false, message: "PrePo not found" });

        if (prePo.status === 'PO_GENERATED') return res.status(400).json({ success: false, message: "You cannot change Status" });

        await prisma.prePo.update({
            where: {
                id: prePoId
            },
            data: {
                status: status.toUpperCase()
            }
        });

        return res.status(200).json({ success: true, message: "Status changed" });


    } catch (er) {
        return res.status(500).json({ success: false, message: "Internal Server Error", error: er?.message });
    }
}

module.exports = {
    createPrePoRequest,
    getPrePoRequest,
    changeRequestStatus,

};