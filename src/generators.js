/**
 * Generate a bibliography from <span class='citation'>
 * @param {puppeteer.page} page - Google Chrome browser tab
 */
exports.bibliography = async function(page) {

    // Get all the keys from citations
    var values = await page.$$eval('.citation', nodes => {
<<<<<<< HEAD
      return nodes.map(node => {
        return node.getAttribute('data-key')
      })
    // Error occurs because there are no citations
    }).catch(e => { return false })
  
    // No citations
    if (!values) return false
  
    const Cite = require('citation-js')
    const data = new Cite()
  
    // Add all keys to citation-js
    values.forEach(val => data.add(val))
  
    // Format the citation spans
    await page.$$eval('.citation', (nodes, data) => {
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
  
    // Get the bibliography style
    // TODO: remove with plugin system: define with [//- use-plugin: bibliography <style>] or [config.json]
    var style = await page.$eval('#bibliography', element => {
        return element.getAttribute('data-style')
    // Error occurs because there is no bibliography
    }).catch(e => { return false })
  
    // No style because no bibliography
    if (!style) return false
  
    // Format html output for bibliography
    const output = data.get({
      format: 'string',
      type: 'html',
      style: style,
      lang: 'en-US'
    })
  
    // Set Bibliography
    await page.$eval('#bibliography', (element, data) => {
      element.innerHTML = data
    }, output)
  
    return true
}

/**
 * Generate a Table of Contents from the headings of the document
 * @param {puppeteer.page} page - Google Chrome browser tab
 * @param {string} width - The width of the page (not including margins) [px, in, cm, mm]
 * @param {string} height - The height of the page (not including margins) [px, in, cm, mm]
 */
exports.ToC = async function(page, width, height) {

    /**
     * Convert the string size to pixel size number (string -> number)
     * @param {string} size - The size of the element to convert to px [px, in, cm, mm]
     */
    var convertSize = function(size) {
        var num = Number(size.match(/\d+\.*\d*/g)[0]) // Get number
        var type = /\d+\.*\d*(\w+)/g.exec(size)[1]    // Get type ['px', 'in', 'cm', 'mm']
        const ppi = 96         // Pixels per inch
        const ppc = 2.54 * ppi // Centimetres per inch
        switch (type) {
            case 'px':
                return num
                break
            case 'mm':
                return num * ppc * 10
                break
            case 'cm':
                return num * ppc
                break
            case 'in':
                return num * ppi
                break
            default:
                return num
                break
        }
    }
    
    /**
     * Generate a table of contents list
     * @param {items[]} items - List of items with their text, depth, and id's
     */
    var makeList = function(items) {
        /*
        @struct items = {
            text: string,
            id: string,
            depth: integer
        }
        */
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
            list += `
                <li class='ToC-link'
                    data-linked='${item.id}'
                    id='${item.id.replace('heading', 'link')}'>
                    <span class='ToC-link-heading'>${item.text}</span>
                    <span class='ToC-link-page-number'>{{PAGEHOLDER}}</span>
                </li>`
        }
        return list + '</ul>'
    }

    // Convert string version of width/height into pixel numbers
    if (typeof width === 'string') width = convertSize(width)
    else if (!width) width = 8.5 * 96
    if (typeof height === 'string') height = convertSize(height)
    else if (!height) height = 11 * 96
    
    // Get the max depth
    var depth = await page.$eval('#table-of-contents', ToC => {
        return ToC.getAttribute('data-depth')
    // Error occurs because there is no table of contents
    }).catch(e => { return false })

    // Does not exist, therefore there is no table of contents
    if (!depth) return false

    depth = Number(depth)

    // Generate search string for page
    var head = ''
    for (var i=1; i<depth; i++) { head += `h${i}, ` }
    head += `h${i}, .new-page`

    // Get the margins of the paper (string of the style)
    var margins = await page.$$eval('style', elements => {
        for (var element of elements) {
            if(/\@page\s*\{[\w\W]*\}/g.test(element.innerHTML)) {
                return element.innerHTML.match(/\@page\s*\{[\w\W]*\}/g)[0]
            }
        }
    })

    var d = '\\s*:\\s*\\d+\\.*\\w+\\s*;'
    var m = 'margin'

    margins = new RegExp(`(${m}${d})|(${m}-top${d})|(${m}-left${d})|(${m}-bottom${d})|(${m}-right${d})`, 'g').exec(margins)

    var sizes = {}
    /*
    @struct sizes = {
        top: integer,
        left: integer,
        bottom: integer,
        right: integer
    }
    */

    // Convert the margin strings to numbers
    if (margins[1] != undefined) {
        // margins for all sides are the same
        size = convertSize(margins[1])
        sizes = {
            top: size,
            left: size,
            bottom: size,
            right: size
        }
    } else {
        // Individual margins for each side
        var convert = function(ind) {
            if(margins[ind] == undefined) {
                return 0
            }
        return convertSize(margins[ind])
        }
        sizes = {
            top: convert(2),
            left: convert(3),
            bottom: convert(4),
            right: convert(5)
        }
    }

    // Set the body width
    await page.$eval('body', (body, width) => {
        body.width = `${width}px`
    }, width - sizes.left - sizes.right)

    // Get all the headings
    var names = await page.$$eval(head, (elements, width, height) => {
        /*
        @struct names = {
            text: string,
            id: string,
            depth: integer
        }
        */
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
    }, width, height - sizes.top - sizes.bottom)

    // Generate a place first pass of the list
    await page.$eval('#table-of-contents', (ToC, list) => {
        ToC.innerHTML = list
    }, makeList(names))

    // Before second pass, get the page numbers 
    var pageNumbers = await page.$$eval(head, (elements, width, height) => {
        /*
        @struct pageNumbers = {
            id: string,
            page: integer
        }
        */
        var elementsFixed = []
        var p = 1
        var newPageError = 0
        for (var element of elements) {
            if (/new\-page/g.test(element.className)) {
                newPageError = (p * height) - (element.offsetTop + element.offsetHeight)
                p++
                continue
            }
            while(element.offsetTop + element.offsetHeight + newPageError >= p * height) {
                p++
            }
            elementsFixed.push({
                id: element.id,
                page: p
            })
        }
        return elementsFixed
    }, width, height)

    // Second pass, replace `{{PAGEHOLDER}}` with actual page number
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
=======
        return nodes.map(node => {
            return node.getAttribute('data-key')
        })
    // Error occurs because there are no citations
    }).catch(e => { return false })

    // No citations
    if (!values) return false

    const Cite = require('citation-js')
    const data = new Cite()

    // Add all keys to citation-js
    values.forEach(val => data.add(val))

    // Format the citation spans
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

    // Get the bibliography style
    // TODO: remove with plugin system: define with [//- use-plugin: bibliography <style>] or [config.json]
    var style = await page.$eval('#bibliography', element => {
        return element.getAttribute('data-style')
    // Error occurs because there is no bibliography
    }).catch(e => { return false })

    // No style because no bibliography
    if (!style) return false

    // Format html output for bibliography
    const output = data.get({
        format: 'string',
        type: 'html',
        style: style,
        lang: 'en-US'
    })

    // Set Bibliography
    await page.$eval('#bibliography', (element, data) => {
        element.innerHTML = data
    }, output)
>>>>>>> origin/master

    return true
}