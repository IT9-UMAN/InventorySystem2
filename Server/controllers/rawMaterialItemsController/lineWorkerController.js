const { default: mongoose } = require("mongoose");
const prisma = require("../../config/prismaClient");
const WarehouseItems = require("../../models/serviceInventoryModels/warehouseItemsSchema");
const { v4: uuid } = require("uuid");

const showStorePersons2 = async (req, res) => {
  try {
    const storeUsers = await prisma.user.findMany({
      where: {
        role: {
          is: {
            name: "Store",
          },
        },
      },
      select: {
        id: true,
        name: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Data Fetched Successfully",
      data: storeUsers || [],
    });
  } catch (error) {
    console.error("ERROR: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//Version v2 - 16/02/2026
const rawMaterialForItemRequest2 = async (req, res) => {
  try {
    const { warehouseId } = req.user;

    if (!warehouseId) {
      return res.status(400).json({
        success: false,
        message: "Warehouse not assigned to user",
      });
    }

    // 1️⃣ Fetch warehouse stock
    const warehouseStock = await prisma.warehouseStock.findMany({
      where: {
        warehouseId: warehouseId,
        isUsed: true,
      },
      orderBy: {
        quantity: "asc",
      },
      select: {
        itemId: true,
        itemType: true,
        quantity: true,
        unit: true,
      },
    });

    // 2️⃣ Separate ids
    const rawIds = warehouseStock.filter(i => i.itemType === "RAW").map(i => i.itemId);
    const infraIds = warehouseStock.filter(i => i.itemType === "INFRA").map(i => i.itemId);
    const toolIds = warehouseStock.filter(i => i.itemType === "TOOL").map(i => i.itemId);

    // 3️⃣ Fetch items in parallel
    const [rawMaterials, infraMaterials, tools] = await Promise.all([
      prisma.rawMaterial.findMany({
        where: { id: { in: rawIds } },
        select: { id: true, name: true },
      }),
      prisma.infraMaterial.findMany({
        where: { id: { in: infraIds } },
        select: { id: true, name: true },
      }),
      prisma.tools_Equipments.findMany({
        where: { id: { in: toolIds } },
        select: { id: true, name: true },
      }),
    ]);

    // 4️⃣ Map items with type
    const itemMap = {};

    rawMaterials.forEach(i => itemMap[i.id] = { ...i, itemType: "RAW" });
    infraMaterials.forEach(i => itemMap[i.id] = { ...i, itemType: "INFRA" });
    tools.forEach(i => itemMap[i.id] = { ...i, itemType: "TOOL" });

    // 5️⃣ Final response (ONLY itemType added)
    const filteredData = warehouseStock
      .filter(stock => itemMap[stock.itemId])
      .map(stock => {
        const item = itemMap[stock.itemId];
        const qty = stock.quantity ?? 0;

        return {
          id: item.id,
          name: item.name,
          stock: qty,
          unit: stock.unit,
          outOfStock: qty === 0,
          itemType: item.itemType,   // ✅ ADDED
        };
      });

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: filteredData || [],
    });

  } catch (error) {
    console.log("ERROR: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const createItemRequest2 = async (req, res) => {
  try {
    const { type, serviceProcessId, materialRequested, requestedTo } =
      req.body;

    const empId = req.user?.id;
    const warehouseId = req.user?.warehouseId;

    if (!warehouseId) {
      return res.status(400).json({
        success: false,
        message: "Warehouse not assigned to logged-in user",
      });
    }

    if (!type || !materialRequested?.length || !requestedTo) {
      throw new Error("All fields are required");
    }

    if (type === "IN" && !serviceProcessId) {
      throw new Error("serviceProcessId is required for in-process requests");
    }

    /* =========================================================
       ✅ Validate storekeeper (same warehouse)
    ========================================================== */

    const storeKeeper = await prisma.user.findFirst({
      where: {
        id: requestedTo,
        warehouseId: warehouseId,
      },
      include: {
        role: { select: { name: true } },
      },
    });

    if (!storeKeeper || storeKeeper.role.name !== "Store") {
      return res.status(400).json({
        success: false,
        message: "You can only request item to storekeeper of same warehouse",
      });
    }

    /* =========================================================
       ✅ Validate stock from NEW warehouseStock structure
    ========================================================== */

    const requestedItems = materialRequested.map(r => ({
      itemId: r.itemId,
      itemType: r.itemType,
      quantity: r.quantity,
    }));

    const warehouseStocks = await prisma.warehouseStock.findMany({
      where: {
        warehouseId,
        isUsed: true,
        OR: requestedItems.map(item => ({
          itemId: item.itemId,
          itemType: item.itemType,
        })),
      },
      select: {
        itemId: true,
        itemType: true,
        quantity: true,
      },
    });

    // Validate each requested item
    for (let item of requestedItems) {
      const stock = warehouseStocks.find(
        s =>
          s.itemId === item.itemId &&
          s.itemType === item.itemType
      );

      if (!stock) {
        throw new Error(`Stock not found in warehouse for requested item`);
      }

      if (item.quantity > (stock.quantity ?? 0)) {
        throw new Error(
          `Requested quantity exceeds available warehouse stock`
        );
      }
    }

    /* =========================================================
       ✅ Create request (structure preserved)
    ========================================================== */

    const newRequest = await prisma.itemRequestData.create({
      data: {
        warehouseId,
        ...(type === "IN" && { serviceProcessId }),
        materialRequested, // keep same JSON structure
        requestedTo,
        requestedBy: empId,
        isProcessRequest: type === "IN",
      },
    });

    return res.status(200).json({
      success: true,
      message: `${
        type === "IN" ? "In-process" : "Pre-process"
      } item request created successfully`,
      data: newRequest,
    });

  } catch (error) {
    console.error("ERROR: ", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const showUserItemStock2 = async (req, res) => {
  try {
    const empId = req?.user?.id;
    if (!empId) {
      throw new Error("Employee ID not found");
    }

    /* =========================================================
       STEP 1: GET USER STOCK
    ========================================================== */
    const itemStock = await prisma.userItemStock.findMany({
      where: {
        empId,
        quantity: { gt: 0 },
      },
      select: {
        id: true,
        empId: true,
        itemId: true,
        itemType: true,
        quantity: true,
        unit: true,
      },
    });

    /* =========================================================
       STEP 2: SEPARATE IDS BY TYPE
    ========================================================== */
    const rawIds = [];
    const infraIds = [];
    const toolIds = [];

    for (const item of itemStock) {
      if (item.itemType === "RAW") rawIds.push(item.itemId);
      if (item.itemType === "INFRA") infraIds.push(item.itemId);
      if (item.itemType === "TOOL") toolIds.push(item.itemId);
    }

    /* =========================================================
       STEP 3: FETCH MASTER DATA
    ========================================================== */
    const [rawMaterials, infraMaterials, tools] = await Promise.all([
      prisma.rawMaterial.findMany({
        where: { id: { in: rawIds } },
        select: { id: true, name: true, stock: true, unit: true },
      }),
      prisma.infraMaterial.findMany({
        where: { id: { in: infraIds } },
        select: { id: true, name: true, stock: true, unit: true },
      }),
      prisma.tools_Equipments.findMany({
        where: { id: { in: toolIds } },
        select: { id: true, name: true, stock: true, unit: true },
      }),
    ]);

    /* =========================================================
       STEP 4: CREATE MAP
    ========================================================== */
    const itemMap = {};

    rawMaterials.forEach(i => itemMap[i.id] = i);
    infraMaterials.forEach(i => itemMap[i.id] = i);
    tools.forEach(i => itemMap[i.id] = i);

    /* =========================================================
       STEP 5: FORMAT RESPONSE (UNCHANGED RESPONSE)
    ========================================================== */
    const response = itemStock.map((item) => {
      const master = itemMap[item.itemId] || {};

      return {
        itemId: item.itemId,                
        itemName: master.name,
        quantity: item.quantity,
        itemStock: master.stock ?? 0,
        unit: master.unit || item.unit,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: response || [],
    });

  } catch (error) {
    console.error("❌ ERROR in showUserItemStock:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const createServiceProcess2 = async (req, res) => {
  try {
    let { productName, itemName, subItemName, serialNumber, quantity } =
      req.body;
    const empId = req.user?.id;
    const empRole = req.user?.role?.name;

    if (!productName || !itemName || !subItemName || !serialNumber) {
      throw new Error("All fields are required");
    }

    serialNumber = serialNumber.trim().toUpperCase();

    // Check if a process already exists for today with same item/subItem/serialNumber
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let itemType;
    if (empRole === "Disassemble") {
      itemType = await prisma.itemType.findFirst({
        where: {
          name: "SERVICE",
        },
        select: {
          id: true,
          name: true,
        },
      });
    } else if (empRole === "SFG Work") {
      itemType = await prisma.itemType.findFirst({
        where: {
          name: "NEW",
        },
        select: {
          id: true,
          name: true,
        },
      });
    }

    const existingProcess = await prisma.service_Process_Record.findFirst({
      where: {
        serialNumber,
        productName,
        itemName,
        subItemName,
        itemTypeId: itemType.id,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    if (existingProcess) {
      return res.status(400).json({
        success: false,
        message: `Service Process for "${itemType.name}" already created today for ${serialNumber}`,
      });
    }

    let itemTypeId, initialStageId;

    if (empRole === "Disassemble") {
      const itemTypeData = await prisma.itemType.findFirst({
        where: { name: "SERVICE" },
        select: { id: true },
      });
      const stageData = await prisma.stage.findFirst({
        where: { name: "Disassemble" },
        select: { id: true },
      });
      if (!itemTypeData || !stageData)
        throw new Error("ItemType or Stage not found");
      itemTypeId = itemTypeData.id;
      initialStageId = stageData.id;
    } else if (empRole === "SFG Work") {
      const itemTypeData = await prisma.itemType.findFirst({
        where: { name: "NEW" },
        select: { id: true },
      });
      const stageData = await prisma.stage.findFirst({
        where: { name: "SFG Work" },
        select: { id: true },
      });
      if (!itemTypeData || !stageData)
        throw new Error("ItemType or Stage not found");
      itemTypeId = itemTypeData.id;
      initialStageId = stageData.id;
    } else {
      throw new Error("You are not allowed to create service process");
    }

    // --- Transaction: Create Service Process + Initial Stage Activity ---
    const newProcess = await prisma.$transaction(async (tx) => {
      const process = await tx.service_Process_Record.create({
        data: {
          productName,
          itemName,
          subItemName,
          serialNumber,
          itemTypeId,
          quantity,
          stageId: initialStageId,
          initialStageId,
          status: "IN_PROGRESS",
          createdBy: empId,
        },
      });

      // Create initial stage activity, leave empId null so user can accept
      await tx.stageActivity.create({
        data: {
          serviceProcessId: process.id,
          stageId: initialStageId,
          status: "PENDING", // Pending until accepted
          isCurrent: true,
        },
      });

      return process;
    });

    return res.status(200).json({
      success: true,
      message: "Service process created and initial stage activity assigned",
      data: newProcess,
    });
  } catch (error) {
    console.error("❌ Error in createServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getPendingActivitiesForUserStage2 = async (req, res) => {
  try {
    const { role } = req.user;
    const empId = req.user?.id;

    if (!role?.name) throw new Error("User role not found");

    const stage = await prisma.stage.findFirst({ where: { name: role.name } });
    if (!stage) throw new Error("Stage not found for this role");

    const whereFilter = {
      stageId: stage.id,
      OR: [
        {
          status: "PENDING",
          empId: null, // unassigned tasks
        },
        {
          status: "IN_PROGRESS",
          empId: empId, // tasks assigned to this employee
        },
      ],
    };

    // Fetch data
    const pendingActivities = await prisma.stageActivity.findMany({
      where: whereFilter,
      include: {
        serviceProcess: {
          select: {
            id: true,
            productName: true,
            itemName: true,
            subItemName: true,
            serialNumber: true,
            quantity: true,
            status: true,
            finalStatus: true,
            isClosed: true,
            isRepaired: true,
            finalRemarks: true,
            isDisassemblePending: true,
            disassembleSessionId: true,
            disassembleStatus: true,
            itemType: { select: { id: true, name: true } },
            stage: { select: { id: true, name: true } },
            initialStage: { select: { id: true, name: true } },
            restartedFromStage: { select: { id: true, name: true } },
          },
        },
        stage: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Count only — much faster than fetching full data again
    const totalCount = await prisma.stageActivity.count({
      where: whereFilter,
    });

    // Transform for frontend
    const response = pendingActivities.map((activity) => ({
      activityId: activity.id,
      processAccepted: activity.acceptedAt !== null,
      processStarted: activity.startedAt !== null,
      processCompleted: activity.completedAt !== null,
      serviceProcessId: activity.serviceProcess.id,
      productName: activity.serviceProcess.productName,
      itemName: activity.serviceProcess.itemName,
      subItemName: activity.serviceProcess.subItemName,
      serialNumber: activity.serviceProcess.serialNumber,
      quantity: activity.serviceProcess.quantity,
      status: activity.serviceProcess.status,
      finalStatus: activity.serviceProcess.finalStatus,
      isClosed: activity.serviceProcess.isClosed,
      isRepaired: activity.serviceProcess.isRepaired,
      finalRemarks: activity.serviceProcess.finalRemarks,
      isDisassemblePending: activity.serviceProcess.isDisassemblePending,
      disassembleSessionId: activity.serviceProcess.disassembleSessionId,
      disassembleStatus: activity.serviceProcess.disassembleStatus,
      itemType: activity.serviceProcess.itemType?.name || null,
      processStage: activity.serviceProcess.stage?.name || null,
      initialStage: activity.serviceProcess.initialStage?.name || null,
      restartedFromStage:
        activity.serviceProcess.restartedFromStage?.name || null,
      activityStage: activity.stage?.name || null,
      createdAt: activity.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Pending activities fetched successfully",
      count: totalCount, // 🔥 count included
      data: response,
    });
  } catch (error) {
    console.error("❌ Error in getPendingActivitiesForUserStage:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const acceptServiceProcess2 = async (req, res) => {
  try {
    const empId = req.user?.id;
    const { serviceProcessId } = req.body;

    if (!serviceProcessId) {
      return res
        .status(400)
        .json({ success: false, message: "Service process ID is required" });
    }

    // Fetch current stage activity for this service process
    const activity = await prisma.stageActivity.findFirst({
      where: { serviceProcessId, isCurrent: true },
      include: { serviceProcess: true, stage: true },
    });
    console.log(activity);
    if (!activity) {
      return res
        .status(404)
        .json({ success: false, message: "No current stage activity found" });
    }

    if (activity.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot accept because status is ${activity.status}`,
      });
    }

    if (activity.empId) {
      return res.status(400).json({
        success: false,
        message: "Already accepted by another employee",
      });
    }

    const serviceProcess = activity.serviceProcess;
    if (["COMPLETED"].includes(serviceProcess.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot accept because process is ${serviceProcess.status}`,
      });
    }

    const updatedActivity = await prisma.stageActivity.update({
      where: { id: activity.id },
      data: {
        user: { connect: { id: empId } }, // ✅ correct way
        status: "IN_PROGRESS",
        acceptedAt: new Date(),
      },
      include: { serviceProcess: true, stage: true },
    });

    return res.status(200).json({
      success: true,
      message: "Service process accepted successfully",
      data: updatedActivity,
    });
  } catch (error) {
    console.error("❌ Error in acceptServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const startServiceProcess2 = async (req, res) => {
  try {
    const empId = req.user?.id;
    const { serviceProcessId } = req.body;

    if (!serviceProcessId) {
      return res
        .status(400)
        .json({ success: false, message: "Service process ID is required" });
    }

    // Fetch current stage activity assigned to this employee
    const activity = await prisma.stageActivity.findFirst({
      where: { serviceProcessId, isCurrent: true, empId },
      include: { serviceProcess: true, stage: true },
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "No stage activity found for this employee",
      });
    }

    if (activity.empId !== empId) {
      return res.status(400).json({
        success: false,
        message: "You are not allowed to access these stage",
      });
    }

    if (activity.status !== "IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: "Process must be accepted before starting",
      });
    }

    if (activity.startedAt) {
      return res
        .status(400)
        .json({ success: false, message: "Process has already been started" });
    }

    // Start the stage
    const updatedActivity = await prisma.stageActivity.update({
      where: { id: activity.id },
      data: { startedAt: new Date() },
      include: { serviceProcess: true, stage: true },
    });

    return res.status(200).json({
      success: true,
      message: "Service process started successfully",
      data: updatedActivity,
    });
  } catch (error) {
    console.error("❌ Error in startServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const showUserItemStock = async (req, res) => {
  try {
    const empId = req?.user?.id;
    if (!empId) {
      throw new Error("Employee ID not found");
    }

    const itemStock = await prisma.userItemStock.findMany({
      where: {
        empId,
        quantity: { gt: 0 },
      },
      select: {
        id: true,
        empId: true,
        quantity: true,
        rawMaterial: {
          select: {
            id: true,
            name: true,
            stock: true,
            unit: true,
          },
        },
      },
    });

    const response = itemStock.map((item) => ({
      rawMaterialId: item.rawMaterial.id,
      rawMaterialName: item.rawMaterial.name,
      quantity: item.quantity,
      itemStock: item.rawMaterial.stock,
      unit: item.rawMaterial.unit,
    }));

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: response || [],
    });
  } catch (error) {
    console.error("❌ ERROR in showUserItemStock:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const createItemUsageLog = async (req, res) => {
  try {
    const { serviceProcessId, rawMaterialList } = req.body;
    const empId = req.user?.id;

    // 🔹 Validation
    if (
      !serviceProcessId ||
      !Array.isArray(rawMaterialList) ||
      rawMaterialList.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }
    if (!empId) {
      return res
        .status(400)
        .json({ success: false, message: "Employee ID not found" });
    }

    // 🔹 Wrap the logic in a transaction for consistency
    await prisma.$transaction(async (tx) => {
      for (const rawMaterial of rawMaterialList) {
        const { rawMaterialId, unit } = rawMaterial;
        const quantity = Number(rawMaterial.quantity);
        // Validate raw material existence
        const existingRawMaterial = await tx.rawMaterial.findUnique({
          where: { id: rawMaterialId },
        });
        if (!existingRawMaterial) {
          throw new Error(`Raw material not found: ${rawMaterialId}`);
        }

        // Validate user's stock
        const userStock = await tx.userItemStock.findUnique({
          where: {
            empId_rawMaterialId: {
              empId,
              rawMaterialId,
            },
          },
        });

        if (!userStock) {
          throw new Error(
            `No stock record found for ${existingRawMaterial.name}`
          );
        }

        if (userStock.quantity < quantity) {
          throw new Error(
            `Insufficient stock for ${existingRawMaterial.name}. Available: ${userStock.quantity}, Required: ${quantity}`
          );
        }

        // 🔹 Deduct quantity from user stock
        await tx.userItemStock.update({
          where: {
            empId_rawMaterialId: {
              empId,
              rawMaterialId,
            },
          },
          data: {
            quantity: { decrement: quantity },
          },
        });

        // 🔹 Log the usage
        await tx.itemUsage.create({
          data: {
            serviceProcessId,
            empId,
            rawMaterialId,
            quantityUsed: quantity,
            unit: unit || existingRawMaterial.unit,
          },
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Process item usage logged successfully",
    });
  } catch (error) {
    console.error("❌ ERROR in createItemUsageLog:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const createItemUsageLog2 = async (req, res) => {
  try {
    const { serviceProcessId, materialList } = req.body;
    const empId = req.user?.id;

    if (!serviceProcessId || !Array.isArray(materialList) || materialList.length === 0) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!empId) {
      return res.status(400).json({ success: false, message: "Employee ID not found" });
    }

    await prisma.$transaction(async (tx) => {

      for (const item of materialList) {

        const itemId = item.itemId; // keep payload unchanged
        const quantity = Number(item.quantity);
        let masterItem = null;
        let itemType = null;

        /* =========================================================
           STEP 1: DETECT ITEM TYPE
        ========================================================== */
        const [raw, infra, tool] = await Promise.all([
          tx.rawMaterial.findUnique({ where: { id: itemId } }),
          tx.infraMaterial.findUnique({ where: { id: itemId } }),
          tx.tools_Equipments.findUnique({ where: { id: itemId } }),
        ]);

        if (raw) { masterItem = raw; itemType = "RAW"; }
        else if (infra) { masterItem = infra; itemType = "INFRA"; }
        else if (tool) { masterItem = tool; itemType = "TOOL"; }

        if (!masterItem) {
          throw new Error(`Item not found: ${itemId}`);
        }

        /* =========================================================
           STEP 2: CHECK USER STOCK
        ========================================================== */
        const userStock = await tx.userItemStock.findUnique({
          where: {
            empId_itemId_itemType: {
              empId,
              itemId,
              itemType,
            },
          },
        });

        if (!userStock) {
          throw new Error(`No stock record found for ${masterItem.name}`);
        }

        if (userStock.quantity < quantity) {
          throw new Error(
            `Insufficient stock for ${masterItem.name}. Available: ${userStock.quantity}, Required: ${quantity}`
          );
        }

        /* =========================================================
           STEP 3: DEDUCT USER STOCK
        ========================================================== */
        await tx.userItemStock.update({
          where: {
            empId_itemId_itemType: {
              empId,
              itemId,
              itemType,
            },
          },
          data: {
            quantity: { decrement: quantity },
          },
        });

        /* =========================================================
           STEP 4: CREATE USAGE LOG
        ========================================================== */
        await tx.itemUsage.create({
          data: {
            serviceProcessId,
            empId,
            itemId,
            itemType,
            quantityUsed: quantity,
            unit: item.unit || masterItem.unit,
          },
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Process item usage logged successfully",
    });

  } catch (error) {
    console.error("❌ ERROR in createItemUsageLog:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const completeServiceProcess2 = async (req, res) => {
  try {
    const { serviceProcessId, status, failureReason, remarks } = req.body;
    const empId = req.user?.id;
    const warehouseId = "67446a8b27dae6f7f4d985dd";

    if (!serviceProcessId || !status || !remarks) {
      return res.status(400).json({
        success: false,
        message: "Service process ID, status, and remarks are required.",
      });
    }

    if (
      status === "FAILED" &&
      (failureReason === "" ||
        failureReason === null ||
        failureReason === undefined)
    ) {
      return res.status(400).json({
        success: false,
        message: `For status - ${status}, failureReason is required.`,
      });
    }

    if (!empId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized user." });
    }

    const processData = await prisma.service_Process_Record.findFirst({
      where: { id: serviceProcessId },
      include: {
        stage: true,
        itemType: true,
      },
    });

    if (!processData) {
      return res
        .status(404)
        .json({ success: false, message: "Service process not found." });
    }

    if (processData.stage?.name === "COMPLETED") {
      return res
        .status(400)
        .json({ success: false, message: "Process already completed." });
    }

    // Fetch product by productName to get productId (required for StageFlow & FailureRedirect)
    const productData = await prisma.product.findFirst({
      where: { productName: processData.productName },
      select: { id: true, productName: true },
    });
    if (!productData) {
      throw new Error(`Product not found: ${processData.productName}`);
    }
    const productId = productData.id;

    // Helper: Failure redirect (uses productId + itemTypeId + failureReason)
    const handleFailureRedirect = async (tx, updatedActivity, reason) => {
      const sp = updatedActivity.serviceProcess;
      const itemTypeId = sp.itemType.id;

      const redirectStage = await tx.failureRedirect.findFirst({
        where: {
          productId,
          itemTypeId,
          failureReason: reason,
        },
        select: { redirectStageId: true },
      });
      console.log(redirectStage);

      if (!redirectStage) {
        throw new Error(
          `Failure redirect not found for productId:${productId}, itemTypeId:${itemTypeId}, reason:${reason}`
        );
      }
      let redirectedStageRecord = null;
      if (reason === "REJECTED") {
        redirectedStageRecord = await tx.stage.findFirst({
          where: {
            id: redirectStage.redirectStageId,
          },
          select: {
            id: true,
            name: true,
          },
        });
      }

      let disassembleTokenToSet = null;
      if (
        redirectedStageRecord &&
        redirectedStageRecord.name === "Disassemble"
      ) {
        disassembleTokenToSet = uuid();
      }

      await tx.service_Process_Record.update({
        where: { id: sp.id },
        data: {
          stageId: redirectStage.redirectStageId,
          restartedFromStageId: redirectStage.redirectStageId,
          status: "REDIRECTED",
          ...(disassembleTokenToSet
            ? {
                disassembleSessionId: disassembleTokenToSet,
                isDisassemblePending: true,
                disassembleStatus: "PENDING",
              }
            : {}),
        },
      });

      await tx.stageActivity.create({
        data: {
          serviceProcessId: sp.id,
          stageId: redirectStage.redirectStageId,
          status: "PENDING",
          isCurrent: true,
        },
      });
    };

    // Helper: move to next stage using productId + itemTypeId + currentStageId
    const moveToNextStage = async (tx, updatedActivity) => {
      const { serviceProcess, stage } = updatedActivity;
      const itemTypeId = serviceProcess.itemType.id;

      const stageFlow = await tx.stageFlow.findFirst({
        where: {
          productId,
          itemTypeId,
          currentStageId: stage.id,
        },
        select: { nextStageId: true },
      });

      // No stage or nextStage -> process completed
      if (!stageFlow || !stageFlow.nextStageId) {
        await tx.service_Process_Record.update({
          where: { id: serviceProcess.id },
          data: {
            status: "COMPLETED",
            finalStatus: "SUCCESS",
            isClosed: true,
            isRepaired:
              serviceProcess.itemType.name === "SERVICE" ? true : null,
            finalRemarks: null,
            updatedBy: String(empId),
            completedAt: new Date(),
          },
        });
        return null;
      }

      // Move to next stage
      await tx.service_Process_Record.update({
        where: { id: serviceProcess.id },
        data: {
          stageId: stageFlow.nextStageId,
          status: "IN_PROGRESS",
        },
      });

      await tx.stageActivity.create({
        data: {
          serviceProcessId: serviceProcess.id,
          stageId: stageFlow.nextStageId,
          status: "PENDING",
          isCurrent: true,
        },
      });

      return stageFlow.nextStageId;
    };

    // Main transaction: update current activity, then branch logic
    const updatedActivity = await prisma.$transaction(async (tx) => {
      // find current stage activity
      const currentActivity = await tx.stageActivity.findFirst({
        where: {
          serviceProcessId,
          stageId: processData.stage.id,
          isCurrent: true,
        },
      });
      if (!currentActivity)
        throw new Error("Current stage activity not found.");

      // update current activity (mark complete / skipped / failed)
      const updated = await tx.stageActivity.update({
        where: { id: currentActivity.id },
        data: {
          empId: String(empId),
          status,
          failureReason: status === "FAILED" ? failureReason : null,
          remarks,
          isCurrent: false,
          completedAt: new Date(),
        },
        include: {
          stage: true,
          serviceProcess: {
            include: {
              itemType: true,
            },
          },
        },
      });

      const { stage } = updated;
      const sp = updated.serviceProcess; // shorthand

      // If Testing stage
      if (stage.name === "Testing") {
        // CASE: Testing success -> final completion (unchanged)
        if (status === "COMPLETED") {
          await tx.service_Process_Record.update({
            where: { id: sp.id },
            data: {
              status: "COMPLETED",
              finalStatus: "SUCCESS",
              isClosed: true,
              isRepaired: sp.itemType.name === "SERVICE" ? true : null,
              finalRemarks: remarks,
              updatedBy: String(empId),
              completedAt: new Date(),
            },
          });
        }

        // CASE: Testing rejected -> redirect to FailureRedirect handling (force REJECTED reason)
        else if (status === "REJECTED") {
          // Use "REJECTED" as the reason to find redirect (ensure failureRedirect record exists for "REJECTED")
          const failReason = "REJECTED";
          await handleFailureRedirect(tx, updated, failReason);
        }

        // CASE: Testing failed -> consult failureReason mapping (only if provided)
        else if (status === "FAILED" && failureReason) {
          await handleFailureRedirect(tx, updated, failureReason);
        }
      }

      // SKIPPED -> directly go next (no warehouse logic)
      else if (status === "SKIPPED") {
        await moveToNextStage(tx, updated);
      }

      // Normal completion -> move to next stage
      else if (status === "COMPLETED") {
        await moveToNextStage(tx, updated);
      }

      return updated;
    });

    // Refresh latest process record to pick up any disassembleSessionId or updated stage
    const latestProcess = await prisma.service_Process_Record.findUnique({
      where: { id: serviceProcessId },
      include: { stage: true, itemType: true },
    });

    // After transaction: update warehouse stock only when Testing stage + completed
    const { stage: updatedStage, serviceProcess } = updatedActivity;

    // if (updatedStage.name === "Testing" && status === "COMPLETED") {
    //   const normalize = (str) =>
    //     str
    //       ?.toLowerCase()
    //       .trim()
    //       .replace(/\s+/g, "")
    //       .replace(/[^a-z0-9.]/g, "");

    //   const subItemName = serviceProcess.subItemName;
    //   const freshWarehouse = await WarehouseItems.findOne({
    //     warehouse: new mongoose.Types.ObjectId(warehouseId),
    //   });
    //   console.log(subItemName);

    //   const normalizedSub = normalize(subItemName);
    //   const existingItem = freshWarehouse.items.find((it) => {
    //     if (!it.itemName) return false;
    //     return normalize(it.itemName) === normalizedSub;
    //   });

    //   if (!existingItem) {
    //     throw new Error(
    //       `Warehouse item not found for "${subItemName}" (normalized: "${normalizedSub}")`
    //     );
    //   }

    //   // decide field and amount
    //   const incField =
    //     serviceProcess.itemType.name === "SERVICE" ? "quantity" : "newStock";
    //   const incAmount = Number(serviceProcess.quantity) || 1;
    //   const matchedItemName = existingItem.itemName;

    //   // atomic update using positional operator
    //   const updateResult = await WarehouseItems.updateOne(
    //     { _id: freshWarehouse._id, "items.itemName": matchedItemName },
    //     { $inc: { [`items.$.${incField}`]: incAmount } }
    //   );

    //   console.log("warehouse updateResult:", updateResult);

    //   if (!updateResult.acknowledged || updateResult.modifiedCount === 0) {
    //     console.warn(
    //       "Atomic update didn't modify any document; running fallback save..."
    //     );
    //     const idx = freshWarehouse.items.findIndex(
    //       (it) => it.itemName === matchedItemName
    //     );
    //     if (idx !== -1) {
    //       freshWarehouse.items[idx][incField] =
    //         (freshWarehouse.items[idx][incField] || 0) + incAmount;
    //       await freshWarehouse.save();
    //       console.log("Fallback save completed.");
    //     } else {
    //       throw new Error(
    //         "Failed to update warehouse: item disappeared between read and update."
    //       );
    //     }
    //   }
    // }

    if (updatedStage.name === "Testing" && status === "COMPLETED") {
      const normalize = (str) =>
        str
          ?.toLowerCase()
          .trim()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9.]/g, "");

      const subItemName = serviceProcess.subItemName;
      const freshWarehouse = await WarehouseItems.findOne({
        warehouse: new mongoose.Types.ObjectId(warehouseId),
      });

      console.log(subItemName);

      const normalizedSub = normalize(subItemName);
      const existingItem = freshWarehouse.items.find((it) => {
        if (!it.itemName) return false;
        return normalize(it.itemName) === normalizedSub;
      });

      if (!existingItem) {
        throw new Error(
          `Warehouse item not found for "${subItemName}" (normalized: "${normalizedSub}")`
        );
      }

      // Increase field
      const incField =
        serviceProcess.itemType.name === "SERVICE" ? "quantity" : "newStock";

      const amount = Number(serviceProcess.quantity) || 1;
      const matchedItemName = existingItem.itemName;

      const updateResult = await WarehouseItems.updateOne(
        {
          _id: freshWarehouse._id,
          "items.itemName": matchedItemName,
        },
        {
          $inc: {
            [`items.$.${incField}`]: amount, // Increase qty/newStock
            "items.$.defective": -amount, // Decrease defective
          },
        }
      );

      console.log("warehouse updateResult:", updateResult);

      if (!updateResult.acknowledged || updateResult.modifiedCount === 0) {
        console.warn(
          "Atomic update didn't modify any document; running fallback save..."
        );

        const idx = freshWarehouse.items.findIndex(
          (it) => it.itemName === matchedItemName
        );

        if (idx !== -1) {
          // Increase qty / newStock
          freshWarehouse.items[idx][incField] =
            (freshWarehouse.items[idx][incField] || 0) + amount;

          // Decrease defective
          freshWarehouse.items[idx].defective =
            (freshWarehouse.items[idx].defective || 0) - amount;

          await freshWarehouse.save();
          console.log("Fallback save completed.");
        } else {
          throw new Error(
            "Failed to update warehouse: item disappeared between read and update."
          );
        }
      }
    }

    if (
      latestProcess.stage?.name === "Disassemble" &&
      latestProcess.disassembleSessionId
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Moved to Disassemble stage. Submit reusable items form to close process.",
        data: {
          stageActivity: updatedActivity,
          serviceProcessId: serviceProcessId,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stage processed successfully & moved to next stage.",
      data: {
        stageActivity: updatedActivity,
        serviceProcessId: serviceProcessId,
      },
    });
  } catch (error) {
    console.error("❌ Error in completeServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

// Only for Disassemble Person in case of item get rejected at testing stage

const getAssembleUsers2 = async (req, res) => {
  try {
    // 1️⃣ Get the role ID for "Assemble"
    const assembleRole = await prisma.role.findFirst({
      where: { name: "Assemble" },
      select: { id: true },
    });

    if (!assembleRole) {
      return res.status(404).json({
        success: false,
        message: "Role 'Assemble' not found.",
      });
    }

    // 2️⃣ Fetch all users with Assemble role
    const users = await prisma.user.findMany({
      where: { roleId: assembleRole.id, isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({
      success: true,
      message: "Assemble users fetched successfully",
      data: users,
    });
  } catch (error) {
    console.error("❌ Error fetching assemble users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getRequestsByUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    const requests = await prisma.itemRequestData.findMany({
      where: { requestedBy: userId },
      select: {
        id: true,
        rawMaterialRequested: true,
        requestedAt: true,
        approved: true,
        declined: true,
        materialGiven: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    if (!requests.length) {
      return res.status(200).json({
        success: true,
        message: "No requests found",
        data: [],
      });
    }

    const allIds = [];
    requests.forEach((reqItem) => {
      reqItem.rawMaterialRequested?.forEach((rm) => {
        if (rm.rawMaterialId) allIds.push(rm.rawMaterialId);
      });
    });

    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { id: { in: allIds } },
      select: { id: true, name: true },
    });

    // Convert to map for faster lookup
    const rawMaterialMap = {};
    rawMaterials.forEach((rm) => {
      rawMaterialMap[rm.id] = rm.name;
    });

    // STEP 4: Attach names into each request item
    const finalData = requests.map((reqItem) => ({
      ...reqItem,
      rawMaterialRequested: reqItem.rawMaterialRequested.map((rm) => ({
        ...rm,
        rawMaterialName: rawMaterialMap[rm.rawMaterialId],
      })),
    }));

    return res.status(200).json({
      success: true,
      message: "Requests fetched successfully",
      data: finalData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const showStorePersons = async (req, res) => {
  try {
    const { warehouseId } = req.user;

    if (!warehouseId) {
      return res.status(400).json({
        success: false,
        message: "Logged-in user has no warehouse assigned",
      });
    }

    const storeUsers = await prisma.user.findMany({
      where: {
        warehouseId: warehouseId,
        role: {
          is: {
            name: "Store",
          },
        },
      },
      select: {
        id: true,
        name: true,
        warehouseId: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Data Fetched Successfully",
      data: storeUsers || [],
    });
  } catch (error) {
    console.error("ERROR: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const rawMaterialForItemRequest = async (req, res) => {
  try {
    const { warehouseId } = req.user;

    if (!warehouseId) {
      return res.status(400).json({
        success: false,
        message: "Warehouse not assigned to user",
      });
    }

    const warehouseStock = await prisma.warehouseStock.findMany({
      where: {
        warehouseId: warehouseId,
        isUsed: true,
      },
      orderBy: {
        quantity: "asc",
      },
      select: {
        rawMaterial: {
          select: {
            id: true,
            name: true,
          },
        },
        quantity: true,
        unit: true,
      },
    });

    const filteredData = warehouseStock
      .filter((item) => item.rawMaterial)
      .map((item) => ({
        id: item.rawMaterial.id,
        name: item.rawMaterial.name,
        stock: item.quantity ?? 0,
        unit: item.unit,
        outOfStock: (item.quantity ?? 0) === 0,
      }));

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: filteredData || [],
    });
  } catch (error) {
    console.log("ERROR: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const createItemRequest = async (req, res) => {
  try {
    const { type, serviceProcessId, rawMaterialRequested, requestedTo } =
      req.body;

    const empId = req.user?.id;
    const warehouseId = req.user?.warehouseId;

    if (!warehouseId) {
      return res.status(400).json({
        success: false,
        message: "Warehouse not assigned to logged-in user",
      });
    }

    if (!type || !rawMaterialRequested?.length || !requestedTo) {
      throw new Error("All fields are required");
    }

    // Validate request type
    if (type === "IN" && !serviceProcessId) {
      throw new Error("serviceProcessId is required for in-process requests");
    }

    // ✅ Validate storekeeper (same warehouse)
    const storeKeeper = await prisma.user.findFirst({
      where: {
        id: requestedTo,
        warehouseId: warehouseId, // 🔐 same warehouse
      },
      include: {
        role: { select: { name: true } },
      },
    });

    if (!storeKeeper || storeKeeper.role.name !== "Store") {
      return res.status(400).json({
        success: false,
        message: "You can only request item to storekeeper of same warehouse",
      });
    }

    // ✅ Validate stock from WarehouseStock (NOT RawMaterial)
    const rawMaterialIds = rawMaterialRequested.map((r) => r.rawMaterialId);

    const warehouseStocks = await prisma.warehouseStock.findMany({
      where: {
        warehouseId: warehouseId,
        rawMaterialId: { in: rawMaterialIds },
        isUsed: true,
      },
      select: {
        rawMaterialId: true,
        quantity: true,
        rawMaterial: {
          select: {
            name: true,
          },
        },
      },
    });

    for (let item of rawMaterialRequested) {
      const stock = warehouseStocks.find(
        (s) => s.rawMaterialId === item.rawMaterialId
      );

      if (!stock) {
        throw new Error(`Stock not found in warehouse for raw material`);
      }

      if (item.quantity > (stock.quantity ?? 0)) {
        throw new Error(
          `Requested quantity for ${stock.rawMaterial.name} exceeds available warehouse stock`
        );
      }
    }

    // ✅ Create item request WITH warehouseId
    const newRequest = await prisma.itemRequestData.create({
      data: {
        warehouseId, // ✅ STORE IT HERE
        ...(type === "IN" && { serviceProcessId }),
        rawMaterialRequested,
        requestedTo,
        requestedBy: empId,
        isProcessRequest: type === "IN",
      },
    });

    return res.status(200).json({
      success: true,
      message: `${
        type === "IN" ? "In-process" : "Pre-process"
      } item request created successfully`,
      data: newRequest,
    });
  } catch (error) {
    console.error("ERROR: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const createServiceProcess = async (req, res) => {
  try {
    let { productName, itemName, subItemName, serialNumber, quantity } =
      req.body;

    const empId = req.user?.id;
    const empRole = req.user?.role?.name;
    const warehouseId = req.user?.warehouseId;

    // 🔐 Warehouse must exist
    if (!warehouseId) {
      return res.status(400).json({
        success: false,
        message: "Warehouse not assigned to logged-in user",
      });
    }

    // 🔐 Role validation (STRICT)
    if (!["Disassemble", "SFG Work"].includes(empRole)) {
      return res.status(403).json({
        success: false,
        message:
          "Only Disassemble or SFG Work users can create service process",
      });
    }

    if (!productName || !itemName || !subItemName || !serialNumber) {
      throw new Error("All fields are required");
    }

    serialNumber = serialNumber.trim().toUpperCase();

    // --- Date range (today) ---
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // --- ItemType based on role ---
    const itemTypeName = empRole === "Disassemble" ? "SERVICE" : "NEW";

    const itemType = await prisma.itemType.findFirst({
      where: { name: itemTypeName },
      select: { id: true, name: true },
    });

    if (!itemType) throw new Error("ItemType not found");

    if(empRole === "Disassemble") {
      const warehouseItemsData = await WarehouseItems.findOne({
        warehouse: warehouseId
      });

      if(!warehouseItemsData) {
        throw new Error("Warehouse Items Data Not Found");
      }

      const itemData = warehouseItemsData.items.find((item) => item.itemName === subItemName);
      if(itemData.defective <= 0) {
        throw new Error(`Defective is ${itemData.defective} for ${itemData.itemName}. Service process cannot be created.`)
      }
    }
    // --- Prevent duplicate process (warehouse-wise) ---
    const existingProcess = await prisma.service_Process_Record.findFirst({
      where: {
        warehouseId, // ✅ warehouse scoped
        serialNumber,
        productName,
        itemName,
        subItemName,
        itemTypeId: itemType.id,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    if (existingProcess) {
      return res.status(400).json({
        success: false,
        message: `Service Process for "${itemType.name}" already created today for ${serialNumber}`,
      });
    }

    // --- Initial Stage ---
    const stageName = empRole === "Disassemble" ? "Disassemble" : "SFG Work";

    const stageData = await prisma.stage.findFirst({
      where: { name: stageName },
      select: { id: true },
    });

    if (!stageData) throw new Error("Stage not found");

    // --- Transaction ---
    const newProcess = await prisma.$transaction(async (tx) => {
      const process = await tx.service_Process_Record.create({
        data: {
          warehouseId, // ✅ STORED HERE
          productName,
          itemName,
          subItemName,
          serialNumber,
          quantity,
          itemTypeId: itemType.id,
          stageId: stageData.id,
          initialStageId: stageData.id,
          status: "IN_PROGRESS",
          createdBy: empId,
        },
      });

      await tx.stageActivity.create({
        data: {
          serviceProcessId: process.id,
          stageId: stageData.id,
          status: "PENDING",
          isCurrent: true,
        },
      });

      return process;
    });

    return res.status(200).json({
      success: true,
      message: "Service process created and initial stage activity assigned",
      data: newProcess,
    });
  } catch (error) {
    console.error("❌ Error in createServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getPendingActivitiesForUserStage = async (req, res) => {
  try {
    const { role } = req.user;
    const empId = req.user?.id;

    if (!role?.name) throw new Error("User role not found");

    const stage = await prisma.stage.findFirst({ where: { name: role.name } });
    if (!stage) throw new Error("Stage not found for this role");

    const whereFilter = {
      stageId: stage.id,
      serviceProcess: {
        warehouseId: req.user.warehouseId,
      },
      OR: [
        {
          status: "PENDING",
          empId: null, // unassigned tasks
        },
        {
          status: "IN_PROGRESS",
          empId: empId, // tasks assigned to this employee
        },
      ],
    };

    // Fetch data
    const pendingActivities = await prisma.stageActivity.findMany({
      where: whereFilter,
      include: {
        serviceProcess: {
          select: {
            id: true,
            productName: true,
            itemName: true,
            subItemName: true,
            serialNumber: true,
            quantity: true,
            status: true,
            finalStatus: true,
            isClosed: true,
            isRepaired: true,
            finalRemarks: true,
            isDisassemblePending: true,
            disassembleSessionId: true,
            disassembleStatus: true,
            itemType: { select: { id: true, name: true } },
            stage: { select: { id: true, name: true } },
            initialStage: { select: { id: true, name: true } },
            restartedFromStage: { select: { id: true, name: true } },
          },
        },
        stage: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Count only — much faster than fetching full data again
    const totalCount = await prisma.stageActivity.count({
      where: whereFilter,
    });

    // Transform for frontend
    const response = pendingActivities.map((activity) => ({
      activityId: activity.id,
      processAccepted: activity.acceptedAt !== null,
      processStarted: activity.startedAt !== null,
      processCompleted: activity.completedAt !== null,
      serviceProcessId: activity.serviceProcess.id,
      productName: activity.serviceProcess.productName,
      itemName: activity.serviceProcess.itemName,
      subItemName: activity.serviceProcess.subItemName,
      serialNumber: activity.serviceProcess.serialNumber,
      quantity: activity.serviceProcess.quantity,
      status: activity.serviceProcess.status,
      finalStatus: activity.serviceProcess.finalStatus,
      isClosed: activity.serviceProcess.isClosed,
      isRepaired: activity.serviceProcess.isRepaired,
      finalRemarks: activity.serviceProcess.finalRemarks,
      isDisassemblePending: activity.serviceProcess.isDisassemblePending,
      disassembleSessionId: activity.serviceProcess.disassembleSessionId,
      disassembleStatus: activity.serviceProcess.disassembleStatus,
      itemType: activity.serviceProcess.itemType?.name || null,
      processStage: activity.serviceProcess.stage?.name || null,
      initialStage: activity.serviceProcess.initialStage?.name || null,
      restartedFromStage:
        activity.serviceProcess.restartedFromStage?.name || null,
      activityStage: activity.stage?.name || null,
      createdAt: activity.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Pending activities fetched successfully",
      count: totalCount, // 🔥 count included
      data: response,
    });
  } catch (error) {
    console.error("❌ Error in getPendingActivitiesForUserStage:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const acceptServiceProcess = async (req, res) => {
  try {
    const empId = req.user?.id;
    const { serviceProcessId } = req.body;

    if (!serviceProcessId) {
      return res
        .status(400)
        .json({ success: false, message: "Service process ID is required" });
    }

    // Fetch current stage activity for this service process
    const activity = await prisma.stageActivity.findFirst({
      where: { serviceProcessId, isCurrent: true },
      include: { serviceProcess: true, stage: true },
    });
    console.log(activity);
    if (!activity) {
      return res
        .status(404)
        .json({ success: false, message: "No current stage activity found" });
    }

    const userWarehouseId = req.user?.warehouseId;

    if (!userWarehouseId) {
      return res.status(403).json({
        success: false,
        message: "Warehouse not assigned to user",
      });
    }

    if (activity.serviceProcess.warehouseId !== userWarehouseId) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to accept service process from another warehouse",
      });
    }

    if (activity.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot accept because status is ${activity.status}`,
      });
    }

    if (activity.empId) {
      return res.status(400).json({
        success: false,
        message: "Already accepted by another employee",
      });
    }

    const serviceProcess = activity.serviceProcess;
    if (["COMPLETED"].includes(serviceProcess.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot accept because process is ${serviceProcess.status}`,
      });
    }

    const updatedActivity = await prisma.stageActivity.update({
      where: { id: activity.id },
      data: {
        user: { connect: { id: empId } }, // ✅ correct way
        status: "IN_PROGRESS",
        acceptedAt: new Date(),
      },
      include: { serviceProcess: true, stage: true },
    });

    return res.status(200).json({
      success: true,
      message: "Service process accepted successfully",
      data: updatedActivity,
    });
  } catch (error) {
    console.error("❌ Error in acceptServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const startServiceProcess = async (req, res) => {
  try {
    const empId = req.user?.id;
    const { serviceProcessId } = req.body;

    if (!serviceProcessId) {
      return res
        .status(400)
        .json({ success: false, message: "Service process ID is required" });
    }

    // Fetch current stage activity assigned to this employee
    const activity = await prisma.stageActivity.findFirst({
      where: { serviceProcessId, isCurrent: true, empId },
      include: { serviceProcess: true, stage: true },
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "No stage activity found for this employee",
      });
    }

    const userWarehouseId = req.user?.warehouseId;

    if (!userWarehouseId) {
      return res.status(403).json({
        success: false,
        message: "Warehouse not assigned to user",
      });
    }

    if (activity.serviceProcess.warehouseId !== userWarehouseId) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to start service process from another warehouse",
      });
    }

    if (activity.empId !== empId) {
      return res.status(400).json({
        success: false,
        message: "You are not allowed to access these stage",
      });
    }

    if (activity.status !== "IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: "Process must be accepted before starting",
      });
    }

    if (activity.startedAt) {
      return res
        .status(400)
        .json({ success: false, message: "Process has already been started" });
    }

    // Start the stage
    const updatedActivity = await prisma.stageActivity.update({
      where: { id: activity.id },
      data: { startedAt: new Date() },
      include: { serviceProcess: true, stage: true },
    });

    return res.status(200).json({
      success: true,
      message: "Service process started successfully",
      data: updatedActivity,
    });
  } catch (error) {
    console.error("❌ Error in startServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const completeServiceProcess = async (req, res) => {
  try {
    const { serviceProcessId, status, failureReason, remarks } = req.body;
    const empId = req.user?.id;
    const userWarehouseId = req.user?.warehouseId;
    //const warehouseId = "67446a8b27dae6f7f4d985dd";

    if (!userWarehouseId || userWarehouseId === null) {
      return res.status(400).json({
        success: false,
        message: "Warehouse not assinged to user.",
      });
    }

    if (!serviceProcessId || !status || !remarks) {
      return res.status(400).json({
        success: false,
        message: "Service process ID, status, and remarks are required.",
      });
    }

    if (
      status === "FAILED" &&
      (failureReason === "" ||
        failureReason === null ||
        failureReason === undefined)
    ) {
      return res.status(400).json({
        success: false,
        message: `For status - ${status}, failureReason is required.`,
      });
    }

    if (!empId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized user." });
    }

    const processData = await prisma.service_Process_Record.findFirst({
      where: { id: serviceProcessId, warehouseId: userWarehouseId },
      include: {
        stage: true,
        itemType: true,
      },
    });

    if (!processData) {
      return res
        .status(404)
        .json({ success: false, message: "Service process not found." });
    }

    if (processData.stage?.name === "COMPLETED") {
      return res
        .status(400)
        .json({ success: false, message: "Process already completed." });
    }

    // Fetch product by productName to get productId (required for StageFlow & FailureRedirect)
    const productData = await prisma.product.findFirst({
      where: { productName: processData.productName },
      select: { id: true, productName: true },
    });
    if (!productData) {
      throw new Error(`Product not found: ${processData.productName}`);
    }
    const productId = productData.id;

    // Helper: Failure redirect (uses productId + itemTypeId + failureReason)
    const handleFailureRedirect = async (tx, updatedActivity, reason) => {
      const sp = updatedActivity.serviceProcess;
      const itemTypeId = sp.itemType.id;

      const redirectStage = await tx.failureRedirect.findFirst({
        where: {
          productId,
          itemTypeId,
          failureReason: reason,
        },
        select: { redirectStageId: true },
      });
      console.log(redirectStage);

      if (!redirectStage) {
        throw new Error(
          `Failure redirect not found for productId:${productId}, itemTypeId:${itemTypeId}, reason:${reason}`
        );
      }
      let redirectedStageRecord = null;
      if (reason === "REJECTED") {
        redirectedStageRecord = await tx.stage.findFirst({
          where: {
            id: redirectStage.redirectStageId,
          },
          select: {
            id: true,
            name: true,
          },
        });
      }

      let disassembleTokenToSet = null;
      if (
        redirectedStageRecord &&
        redirectedStageRecord.name === "Disassemble"
      ) {
        disassembleTokenToSet = uuid();
      }

      await tx.service_Process_Record.update({
        where: { id: sp.id },
        data: {
          stageId: redirectStage.redirectStageId,
          restartedFromStageId: redirectStage.redirectStageId,
          status: "REDIRECTED",
          ...(disassembleTokenToSet
            ? {
                disassembleSessionId: disassembleTokenToSet,
                isDisassemblePending: true,
                disassembleStatus: "PENDING",
              }
            : {}),
        },
      });

      await tx.stageActivity.create({
        data: {
          serviceProcessId: sp.id,
          stageId: redirectStage.redirectStageId,
          status: "PENDING",
          isCurrent: true,
        },
      });
    };

    // Helper: move to next stage using productId + itemTypeId + currentStageId
    const moveToNextStage = async (tx, updatedActivity) => {
      const { serviceProcess, stage } = updatedActivity;
      const itemTypeId = serviceProcess.itemType.id;

      const stageFlow = await tx.stageFlow.findFirst({
        where: {
          productId,
          itemTypeId,
          currentStageId: stage.id,
        },
        select: { nextStageId: true },
      });

      // No stage or nextStage -> process completed
      if (!stageFlow || !stageFlow.nextStageId) {
        await tx.service_Process_Record.update({
          where: { id: serviceProcess.id },
          data: {
            status: "COMPLETED",
            finalStatus: "SUCCESS",
            isClosed: true,
            isRepaired:
              serviceProcess.itemType.name === "SERVICE" ? true : null,
            finalRemarks: null,
            updatedBy: String(empId),
            completedAt: new Date(),
          },
        });
        return null;
      }

      // Move to next stage
      await tx.service_Process_Record.update({
        where: { id: serviceProcess.id },
        data: {
          stageId: stageFlow.nextStageId,
          status: "IN_PROGRESS",
        },
      });

      await tx.stageActivity.create({
        data: {
          serviceProcessId: serviceProcess.id,
          stageId: stageFlow.nextStageId,
          status: "PENDING",
          isCurrent: true,
        },
      });

      return stageFlow.nextStageId;
    };

    // Main transaction: update current activity, then branch logic
    const updatedActivity = await prisma.$transaction(async (tx) => {
      // find current stage activity
      const currentActivity = await tx.stageActivity.findFirst({
        where: {
          serviceProcessId,
          stageId: processData.stage.id,
          isCurrent: true,
        },
      });
      if (!currentActivity)
        throw new Error("Current stage activity not found.");

      // update current activity (mark complete / skipped / failed)
      const updated = await tx.stageActivity.update({
        where: { id: currentActivity.id },
        data: {
          empId: String(empId),
          status,
          failureReason: status === "FAILED" ? failureReason : null,
          remarks,
          isCurrent: false,
          completedAt: new Date(),
        },
        include: {
          stage: true,
          serviceProcess: {
            include: {
              itemType: true,
            },
          },
        },
      });

      const { stage } = updated;
      const sp = updated.serviceProcess; // shorthand

      // If Testing stage
      if (stage.name === "Testing") {
        // CASE: Testing success -> final completion (unchanged)
        if (status === "COMPLETED") {
          await tx.service_Process_Record.update({
            where: { id: sp.id },
            data: {
              status: "COMPLETED",
              finalStatus: "SUCCESS",
              isClosed: true,
              isRepaired: sp.itemType.name === "SERVICE" ? true : null,
              finalRemarks: remarks,
              updatedBy: String(empId),
              completedAt: new Date(),
            },
          });
        }

        // CASE: Testing rejected -> redirect to FailureRedirect handling (force REJECTED reason)
        else if (status === "REJECTED") {
          // Use "REJECTED" as the reason to find redirect (ensure failureRedirect record exists for "REJECTED")
          const failReason = "REJECTED";
          await handleFailureRedirect(tx, updated, failReason);
        }

        // CASE: Testing failed -> consult failureReason mapping (only if provided)
        else if (status === "FAILED" && failureReason) {
          await handleFailureRedirect(tx, updated, failureReason);
        }
      }

      // SKIPPED -> directly go next (no warehouse logic)
      else if (status === "SKIPPED") {
        await moveToNextStage(tx, updated);
      }

      // Normal completion -> move to next stage
      else if (status === "COMPLETED") {
        await moveToNextStage(tx, updated);
      }

      return updated;
    });

    // Refresh latest process record to pick up any disassembleSessionId or updated stage
    const latestProcess = await prisma.service_Process_Record.findUnique({
      where: { id: serviceProcessId },
      include: { stage: true, itemType: true },
    });

    // After transaction: update warehouse stock only when Testing stage + completed
    const { stage: updatedStage, serviceProcess } = updatedActivity;

    if (updatedStage.name === "Testing" && status === "COMPLETED") {
      const normalize = (str) =>
        str
          ?.toLowerCase()
          .trim()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9.]/g, "");

      const subItemName = serviceProcess.subItemName;
      const freshWarehouse = await WarehouseItems.findOne({
        warehouse: new mongoose.Types.ObjectId(serviceProcess.warehouseId),
      });

      console.log(subItemName);

      const normalizedSub = normalize(subItemName);
      const existingItem = freshWarehouse.items.find((it) => {
        if (!it.itemName) return false;
        return normalize(it.itemName) === normalizedSub;
      });

      if (!existingItem) {
        throw new Error(
          `Warehouse item not found for "${subItemName}" (normalized: "${normalizedSub}")`
        );
      }

      const amount = Number(serviceProcess.quantity) || 1;
      const matchedItemName = existingItem.itemName;

      const isService = serviceProcess.itemType.name === "SERVICE";
      const updateOps = {
        [`items.$.${isService ? "quantity" : "newStock"}`]: amount,
      };

      if (isService) {
        updateOps["items.$.defective"] = -amount;
      }

      const updateResult = await WarehouseItems.updateOne(
        {
          _id: freshWarehouse._id,
          "items.itemName": matchedItemName,
        },
        {
          $inc: updateOps,
        }
      );

      console.log("warehouse updateResult:", updateResult);

      if (!updateResult.acknowledged || updateResult.modifiedCount === 0) {
        console.warn(
          "Atomic update didn't modify any document; running fallback save..."
        );

        const idx = freshWarehouse.items.findIndex(
          (it) => it.itemName === matchedItemName
        );

        if (idx !== -1) {
          // // Increase qty / newStock
          // freshWarehouse.items[idx][incField] =
          //   (freshWarehouse.items[idx][incField] || 0) + amount;

          // // Decrease defective
          // freshWarehouse.items[idx].defective =
          //   (freshWarehouse.items[idx].defective || 0) - amount;
          if (isService) {
            freshWarehouse.items[idx].quantity =
              (freshWarehouse.items[idx].quantity || 0) + amount;
            freshWarehouse.items[idx].defective =
              (freshWarehouse.items[idx].defective || 0) - amount;
          } else {
            freshWarehouse.items[idx].newStock =
              (freshWarehouse.items[idx].newStock || 0) + amount;
          }

          await freshWarehouse.save();
          console.log("Fallback save completed.");
        } else {
          throw new Error(
            "Failed to update warehouse: item disappeared between read and update."
          );
        }
      }
    }

    if (
      latestProcess.stage?.name === "Disassemble" &&
      latestProcess.disassembleSessionId
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Moved to Disassemble stage. Submit reusable items form to close process.",
        data: {
          stageActivity: updatedActivity,
          serviceProcessId: serviceProcessId,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stage processed successfully & moved to next stage.",
      data: {
        stageActivity: updatedActivity,
        serviceProcessId: serviceProcessId,
      },
    });
  } catch (error) {
    console.error("❌ Error in completeServiceProcess:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getAssembleUsers = async (req, res) => {
  try {
    const userWarehouseId = req.user?.warehouseId;
    // 1️⃣ Get the role ID for "Assemble"
    const assembleRole = await prisma.role.findFirst({
      where: { name: "Assemble" },
      select: { id: true },
    });

    if (!assembleRole) {
      return res.status(404).json({
        success: false,
        message: "Role 'Assemble' not found.",
      });
    }

    // 2️⃣ Fetch all users with Assemble role
    const users = await prisma.user.findMany({
      where: {
        roleId: assembleRole.id,
        isActive: true,
        warehouseId: userWarehouseId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({
      success: true,
      message: "Assemble users fetched successfully",
      data: users,
    });
  } catch (error) {
    console.error("❌ Error fetching assemble users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const disassembleReusableItemsForm = async (req, res) => {
  try {
    const empId = req.user.id;
    const {
      serviceProcessId,
      disassembleSessionId,
      assembleEmpId,
      reusableItems,
      remarks,
    } = req.body;

    // ------------------- VALIDATION -------------------
    if (
      !serviceProcessId ||
      !disassembleSessionId ||
      !assembleEmpId ||
      !reusableItems ||
      !remarks
    ) {
      return res.status(400).json({
        success: false,
        message:
          "serviceProcessId, disassembleSessionId, assembleEmpId, reusableItems and remarks are required",
      });
    }

    const existingUser = await prisma.User.findFirst({
      where: {
        id: empId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User Not Found",
      });
    }

    if (existingUser.role.name !== "Disassemble") {
      return res.status(400).json({
        success: false,
        message:
          "Unautorized Access: Only disassemble employee is allowed to fill this form.",
      });
    }
    // ------------------- FETCH PROCESS -------------------
    const serviceProcess = await prisma.service_Process_Record.findFirst({
      where: { id: serviceProcessId },
      include: {
        stage: true,
        itemType: true,
      },
    });

    if (!serviceProcess) {
      return res
        .status(404)
        .json({ success: false, message: "Service process not found" });
    }

    // Check if process is in Disassemble stage and session matches
    if (serviceProcess.disassembleSessionId !== disassembleSessionId) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired disassemble session",
      });
    }

    if (!serviceProcess.isDisassemblePending) {
      return res.status(400).json({
        success: false,
        message: "Process is not in disassemble pending state",
      });
    }

    // ------------------- TRANSACTION BLOCK -------------------
    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ Create reusable item entry
      const disassembleEntry = await tx.disassemble_Reusable_Items.create({
        data: {
          serviceProcessId,
          empId,
          assembleEmpId,
          reusableItems,
          remarks,
        },
      });

      // 2️⃣ Update Assemble Employee Stock
      for (const rawMaterial of reusableItems) {
        const { rawMaterialId, quantity, unit } = rawMaterial;
        if (!rawMaterialId || quantity === null || quantity <= 0 || !unit) {
          throw new Error(
            "rawMaterialId, valid quantity (>0), and unit are required in every item"
          );
        }
        const qty = Number(quantity);

        await tx.userItemStock.upsert({
          where: {
            empId_rawMaterialId: {
              empId: assembleEmpId,
              rawMaterialId,
            },
          },
          update: { quantity: { increment: qty } },
          create: {
            empId: assembleEmpId,
            rawMaterialId,
            quantity: qty,
            unit,
          },
        });
      }

      // 3️⃣ Close the Disassemble Stage Activity
      await tx.stageActivity.updateMany({
        where: {
          serviceProcessId,
          empId,
          isCurrent: true,
          status: "IN_PROGRESS",
        },
        data: {
          status: "COMPLETED",
          isCurrent: false,
          completedAt: new Date(),
          remarks,
          empId,
        },
      });

      // 4️⃣ Close the main service process
      await tx.service_Process_Record.update({
        where: { id: serviceProcessId },
        data: {
          finalStatus: "REJECTED",
          finalRemarks: remarks,
          isClosed: true,
          isRepaired: false,
          status: "COMPLETED",
          completedAt: new Date(),
          disassembleStatus: "COMPLETED",
          isDisassemblePending: false,
          disassembleSessionId: null,
        },
      });

      return disassembleEntry;
    });

    const warehouse = await WarehouseItems.findOne({
      warehouse: serviceProcess.warehouseId,
    });
    const qty = Number(serviceProcess.quantity) || 1;
    if (!warehouse) {
      throw new Error(`⚠ Warehouse items data not found.`);
    } else {
      const idx = warehouse.items.findIndex(
        (it) =>
          it.itemName &&
          it.itemName.trim().toLowerCase() ===
            serviceProcess.subItemName.trim().toLowerCase()
      );

      if (idx === -1) {
        throw new Error(
          `⚠ Item '${serviceProcess.subItemName}' not found in warehouse`
        );
      } else {
        warehouse.items[idx].defective =
          (warehouse.items[idx].defective || 0) - qty;

        // Prevent negative values
        if (warehouse.items[idx].defective < 0) {
          warehouse.items[idx].defective = 0;
        }

        await warehouse.save();
        console.log("✅ Warehouse defective count updated");
      }
    }

    // ------------------- RESPONSE -------------------
    return res.status(200).json({
      success: true,
      message: "Disassemble form submitted & process closed successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error in submitDisassembleForm:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const disassembleReusableItemsForm2 = async (req, res) => {
  try {
    const empId = req.user.id;
    const {
      serviceProcessId,
      disassembleSessionId,
      assembleEmpId,
      reusableItems,
      remarks,
    } = req.body;

    // ------------------- VALIDATION -------------------
    if (
      !serviceProcessId ||
      !disassembleSessionId ||
      !assembleEmpId ||
      !reusableItems ||
      !remarks
    ) {
      return res.status(400).json({
        success: false,
        message:
          "serviceProcessId, disassembleSessionId, assembleEmpId, reusableItems and remarks are required",
      });
    }

    const existingUser = await prisma.User.findFirst({
      where: {
        id: empId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User Not Found",
      });
    }

    if (existingUser.role.name !== "Disassemble") {
      return res.status(400).json({
        success: false,
        message:
          "Unautorized Access: Only disassemble employee is allowed to fill this form.",
      });
    }
    // ------------------- FETCH PROCESS -------------------
    const serviceProcess = await prisma.service_Process_Record.findFirst({
      where: { id: serviceProcessId },
      include: {
        stage: true,
        itemType: true,
      },
    });

    if (!serviceProcess) {
      return res
        .status(404)
        .json({ success: false, message: "Service process not found" });
    }

    // Check if process is in Disassemble stage and session matches
    if (serviceProcess.disassembleSessionId !== disassembleSessionId) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired disassemble session",
      });
    }

    if (!serviceProcess.isDisassemblePending) {
      return res.status(400).json({
        success: false,
        message: "Process is not in disassemble pending state",
      });
    }

    // ------------------- TRANSACTION BLOCK -------------------
    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ Create reusable item entry
      const disassembleEntry = await tx.disassemble_Reusable_Items.create({
        data: {
          serviceProcessId,
          empId,
          assembleEmpId,
          reusableItems,
          remarks,
        },
      });

      // 2️⃣ Update Assemble Employee Stock
      for (const item of reusableItems) {
        const { itemId, quantity, unit } = itemId;
        if (!itemId || quantity === null || quantity <= 0 || !unit) {
          throw new Error(
            "itemId, valid quantity (>0), and unit are required in every item"
          );
        }
        const qty = Number(quantity);

        await tx.userItemStock.upsert({
          where: {
            empId_itemId: {
              empId: assembleEmpId,
              itemId,
            },
          },
          update: { quantity: { increment: qty } },
          create: {
            empId: assembleEmpId,
            itemId,
            quantity: qty,
            unit,
          },
        });
      }

      // 3️⃣ Close the Disassemble Stage Activity
      await tx.stageActivity.updateMany({
        where: {
          serviceProcessId,
          empId,
          isCurrent: true,
          status: "IN_PROGRESS",
        },
        data: {
          status: "COMPLETED",
          isCurrent: false,
          completedAt: new Date(),
          remarks,
          empId,
        },
      });

      // 4️⃣ Close the main service process
      await tx.service_Process_Record.update({
        where: { id: serviceProcessId },
        data: {
          finalStatus: "REJECTED",
          finalRemarks: remarks,
          isClosed: true,
          isRepaired: false,
          status: "COMPLETED",
          completedAt: new Date(),
          disassembleStatus: "COMPLETED",
          isDisassemblePending: false,
          disassembleSessionId: null,
        },
      });

      return disassembleEntry;
    });

    const warehouse = await WarehouseItems.findOne({
      warehouse: serviceProcess.warehouseId,
    });
    const qty = Number(serviceProcess.quantity) || 1;
    if (!warehouse) {
      throw new Error(`⚠ Warehouse items data not found.`);
    } else {
      const idx = warehouse.items.findIndex(
        (it) =>
          it.itemName &&
          it.itemName.trim().toLowerCase() ===
            serviceProcess.subItemName.trim().toLowerCase()
      );

      if (idx === -1) {
        throw new Error(
          `⚠ Item '${serviceProcess.subItemName}' not found in warehouse`
        );
      } else {
        warehouse.items[idx].defective =
          (warehouse.items[idx].defective || 0) - qty;

        // Prevent negative values
        if (warehouse.items[idx].defective < 0) {
          warehouse.items[idx].defective = 0;
        }

        await warehouse.save();
        console.log("✅ Warehouse defective count updated");
      }
    }

    // ------------------- RESPONSE -------------------
    return res.status(200).json({
      success: true,
      message: "Disassemble form submitted & process closed successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error in submitDisassembleForm:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  showStorePersons,
  rawMaterialForItemRequest,
  createItemRequest,
  createServiceProcess,
  getPendingActivitiesForUserStage,
  acceptServiceProcess,
  startServiceProcess,
  completeServiceProcess,
  showUserItemStock,
  createItemUsageLog,
  getAssembleUsers,
  disassembleReusableItemsForm,
  getRequestsByUser,
  showStorePersons2,
  rawMaterialForItemRequest2,
  createItemRequest2,
  createServiceProcess2,
  getPendingActivitiesForUserStage2,
  acceptServiceProcess2,
  startServiceProcess2,
  completeServiceProcess2,
  getAssembleUsers2,
  disassembleReusableItemsForm2,
};
