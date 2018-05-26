exports.bibliography = async function (page) {
    
    var values = await page.$$eval('.citation', nodes => {
        return nodes.map(node => {
            return node.getAttribute('data-key')
        })
        // Error occurs because there are no citations
    }).catch(e => { return false })

    if (!values)  return false

    const Cite = require('citation-js')

    const data = new Cite()

    values.forEach(val => data.add(val))

    var result = await page.$$eval('.citation', (nodes, data) => {
        for (var element of nodes) {
        let key = element.getAttribute('data-key')
        let page = element.getAttribute('data-page')
        for (var datum of data) {
            if (datum.id == key) {
            if (page != '') {
                element.innerHTML = `(${datum.author[0].family}, ${datum.issued['date-parts'][0][0]}, p. ${page})`
            } else {
                element.innerHTML = `(${datum.author[0].family}, ${datum.issued['date-parts'][0][0]})`
            }
            break
            }
        }
        }
    }, data.data)

    var style = await page.$eval('#bibliography', element => {
        return element.getAttribute('data-style')
    }).catch(e => {
        // Error occurs because there is no bibliography
        return false
    })

    if (!style) return false

    const output = data.get({
        format: 'string',
        type: 'html',
        style: style,
        lang: 'en-US'
    })

    var final = await page.$eval('#bibliography', (element, data) => {
        element.innerHTML = data
    }, output)

    return true
}

exports.ToC = async function(page) {
    const ppi = 96
    var width = 8.5 * ppi
    var height = 11 * ppi

    var depth = await page.$eval('#table-of-contents', ToC => {
        return ToC.getAttribute('data-depth')
    }).catch(e => {
        return false
    })

    if (!depth) return false

    depth = Number(depth)

    var head = ''

    for (var i=1; i<depth; i++) {
        head += `h${i}, `
    }
    head += `h${i}, .new-page`

    await page.$eval('body', (body, width) => {
        body.width = `${width}px`
    }, width)

    var names = await page.$$eval(head, (elements, width, height) => {
        var elementsFixed = []
        var i = 0
        for (var element of elements) {
            if (/new\-page/g.test(element.className)) {
                continue
            }
            if (element.id == '') {
                element.id = `ToC-heading-id-${i}`
                i++
            }
            elementsFixed.push({
                text: element.innerHTML,
                id: element.id,
                depth: Number(element.tagName.replace('H', ''))
            })
        }
        return elementsFixed
    }, width, height)

    await page.$eval('#table-of-contents', (ToC, list) => {
        ToC.innerHTML = list
    }, makeList(names))

    var pageNumbers = await page.$$eval(head, (elements, width, height) => {
        var elementsFixed = []
        var p = 1
        for (var element of elements) {
            if (/new\-page/g.test(element.className)) {
                p++
                continue
            }
            while(element.offsetTop + element.offsetHeight >= p * height) {
                p++
            }
            elementsFixed.push({
                id: element.id,
                page: p
            })
        }
        return elementsFixed
    }, width, height)

    console.log(pageNumbers)

    await page.$$eval('.ToC-link', (elements, pageNumbers) => {
        for (var element of elements) {
            for (var page of pageNumbers) {
                if (page.id == element.getAttribute('data-linked')) {
                    element.innerHTML = element.innerHTML.replace('{{PAGEHOLDER}}', page.page)
                    break
                }
            }
        }
    }, pageNumbers)

    return true
}

function makeList(items) {
    var depth = 1
    var list = `<ul class='table-of-contents-list'>`
    for (var item of items) {
        if (item.depth > depth) {
            list += '<ul>'
            depth++
        } else if(item.depth < depth) {
            list += '</ul>'
            depth--
        }
        list += `<li class='ToC-link' data-linked='${item.id}' id='${item.id.replace('heading', 'link')}'><span class='ToC-link-heading'>${item.text}</span><span class='ToC-link-page-number'>{{PAGEHOLDER}}</span></li>`
    }
    return list + '</ul>'
}