var express = require("express");
var router = express.Router();
let { uploadImage, uploadExcel } = require('../utils/uploadHandler')
let exceljs = require('exceljs')
let path = require('path')
let fs = require('fs')
let mongoose = require('mongoose');
let productModel = require('../schemas/products')
let inventoryModel = require('../schemas/inventories')
let categoryModel = require('../schemas/categories')
let slugify = require('slugify')
let crypto = require('crypto')
let userModel = require('../schemas/users')
let roleModel = require('../schemas/roles')
let cartSchema = require('../schemas/carts')
let { sendPasswordMail } = require('../utils/mailHandler')

router.post('/an_image', uploadImage.single('file')
    , function (req, res, next) {
        if (!req.file) {
            res.send({
                message: "file khong duoc rong"
            })
        } else {
            res.send({
                filename: req.file.filename,
                path: req.file.path,
                size: req.file.size
            })
        }
    })
router.get('/:filename', function (req, res, next) {
    let filename = path.join(__dirname, '../uploads', req.params.filename)
    res.sendFile(filename)
})

router.post('/multiple_images', uploadImage.array('files', 5)
    , function (req, res, next) {
        if (!req.files) {
            res.send({
                message: "file khong duoc rong"
            })
        } else {
            res.send(req.files.map(f => {
                return {
                    filename: f.filename,
                    path: f.path,
                    size: f.size
                }
            }))
        }
    })

router.post('/excel', uploadExcel.single('file')
    , async function (req, res, next) {
        if (!req.file) {
            res.send({
                message: "file khong duoc rong"
            })
        } else {
            //wookbook->worksheet->row/column->cell
            let workBook = new exceljs.Workbook()
            let filePath = path.join(__dirname, '../uploads', req.file.filename)
            await workBook.xlsx.readFile(filePath)
            let worksheet = workBook.worksheets[0];
            let result = [];

            let categoryMap = new Map();
            let categories = await categoryModel.find({
            })
            for (const category of categories) {
                categoryMap.set(category.name, category._id)
            }

            let products = await productModel.find({})
            let getTitle = products.map(
                p => p.title
            )
            let getSku = products.map(
                p => p.sku
            )

            for (let index = 2; index <= worksheet.rowCount; index++) {
                let errorsRow = [];
                const element = worksheet.getRow(index);
                let sku = element.getCell(1).value;
                let title = element.getCell(2).value;
                let category = element.getCell(3).value;
                let price = Number.parseInt(element.getCell(4).value);
                let stock = Number.parseInt(element.getCell(5).value);

                if (price < 0 || isNaN(price)) {
                    errorsRow.push("price khong duoc nho hon 0 va la so")
                }
                if (stock < 0 || isNaN(stock)) {
                    errorsRow.push("stock khong duoc nho hon 0 va la so")
                }
                if (!categoryMap.has(category)) {
                    errorsRow.push("category khong hop le")
                }
                if (getSku.includes(sku)) {
                    errorsRow.push("sku da ton tai")
                }
                if (getTitle.includes(title)) {
                    errorsRow.push("title da ton tai")
                }

                if (errorsRow.length > 0) {
                    result.push({
                        success: false,
                        data: errorsRow
                    })
                    continue;
                }
                let session = await mongoose.startSession()
                session.startTransaction()
                try {
                    let newProducts = new productModel({
                        sku: sku,
                        title: title,
                        slug: slugify(title, {
                            replacement: '-',
                            lower: false,
                            remove: undefined,
                        }),
                        description: title,
                        category: categoryMap.get(category),
                        price: price
                    })
                    await newProducts.save({ session })
                    let newInventory = new inventoryModel({
                        product: newProducts._id,
                        stock: stock
                    })
                    await newInventory.save({ session });
                    await newInventory.populate('product')
                    await session.commitTransaction();
                    await session.endSession()
                    getTitle.push(title);
                    getSku.push(sku)
                    result.push({
                        success: true,
                        data: newInventory
                    })
                } catch (error) {
                    await session.abortTransaction();
                    await session.endSession()
                    result.push({
                        success: false,
                        data: error.message
                    })
                }
            }
            fs.unlinkSync(filePath)
            result = result.map((r, index) => {
                if (r.success) {
                    return {
                        [index + 1]: r.data
                    }
                } else {
                    return {
                        [index + 1]: r.data.join(',')
                    }
                }
            })
            res.send(result)
        }

    })

router.post('/users', uploadExcel.single('file')
    , async function (req, res, next) {
        if (!req.file) {
            res.send({
                message: "file khong duoc rong"
            })
        } else {
            let workBook = new exceljs.Workbook()
            let filePath = path.join(__dirname, '../uploads', req.file.filename)
            await workBook.xlsx.readFile(filePath)
            let worksheet = workBook.worksheets[0];
            let result = [];

            // Tim role USER trong DB
            let userRole = await roleModel.findOne({ name: "USER" })
            if (!userRole) {
                fs.unlinkSync(filePath)
                return res.status(400).send({ message: "Role USER khong ton tai trong DB" })
            }

            // Lay danh sach username va email da ton tai
            let existingUsers = await userModel.find({})
            let existingUsernames = existingUsers.map(u => u.username)
            let existingEmails = existingUsers.map(u => u.email)

            for (let index = 2; index <= worksheet.rowCount; index++) {
                let errorsRow = [];
                const element = worksheet.getRow(index);

                let username = element.getCell(1).value;
                let emailCell = element.getCell(2).value;
                // Xu ly truong hop email la formula
                let email = typeof emailCell === 'object' && emailCell !== null
                    ? emailCell.result
                    : emailCell;

                if (!username) {
                    errorsRow.push("username khong duoc rong")
                }
                if (!email) {
                    errorsRow.push("email khong duoc rong")
                }
                if (existingUsernames.includes(username)) {
                    errorsRow.push("username da ton tai")
                }
                if (existingEmails.includes(email)) {
                    errorsRow.push("email da ton tai")
                }

                if (errorsRow.length > 0) {
                    result.push({
                        success: false,
                        data: errorsRow
                    })
                    continue;
                }

                // Random password 16 ky tu
                let password = crypto.randomBytes(8).toString('hex'); // 16 ky tu hex

                let session = await mongoose.startSession()
                session.startTransaction()
                try {
                    let newUser = new userModel({
                        username: username,
                        password: password,
                        email: email,
                        role: userRole._id
                    })
                    await newUser.save({ session })

                    let newCart = new cartSchema({
                        user: newUser._id
                    })
                    await newCart.save({ session })

                    await session.commitTransaction();
                    await session.endSession()

                    existingUsernames.push(username)
                    existingEmails.push(email)

                    // Gui email password cho user
                    try {
                        await sendPasswordMail(email, username, password)
                    } catch (mailError) {
                        console.log("Loi gui mail cho " + username + ": " + mailError.message)
                    }

                    result.push({
                        success: true,
                        data: {
                            username: username,
                            email: email
                        }
                    })
                } catch (error) {
                    await session.abortTransaction();
                    await session.endSession()
                    result.push({
                        success: false,
                        data: error.message
                    })
                }
            }
            fs.unlinkSync(filePath)
            result = result.map((r, index) => {
                if (r.success) {
                    return {
                        [index + 1]: r.data
                    }
                } else {
                    return {
                        [index + 1]: typeof r.data === 'string' ? r.data : r.data.join(',')
                    }
                }
            })
            res.send(result)
        }
    })

module.exports = router;