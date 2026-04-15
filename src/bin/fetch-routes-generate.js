// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
const yaml = require('js-yaml');
const convertToSlug = (str) => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
};

function convertRoutesVirtual(listContent) {
  const filterListRoutes = listContent.flat().filter((cate) => cate !== undefined && cate?.text !== null && cate?.text.trim() !== '')
  let listRoutes = filterListRoutes.map((cate) => convertToSlug(cate?.text));
  listRoutes = [...new Set(listRoutes)];
  return listRoutes;
}
 
function generateRoutes() {
  const domainName = process.cwd();
 
  const getNestedFiles = async (dir) => {
    return new Promise((resolve, reject) => {
      fs.readdir(`${domainName}/content/` + dir, async (_err, _files) => {
        if (_err) return reject(_err);
 
        let folders = _files?.filter(file => !file?.includes(".yml"));
        let notFolders = _files?.filter(file => file?.includes(".yml"));
        let nestedFiles = [];
        let listCate = [];
        let listTags = [];
        // Đọc thư mục con (folders) không đồng bộ
        await Promise.all(folders.map(async folder => {
          const filesInFolder = await getNestedFiles(dir + "/" + folder);
          nestedFiles.push(...filesInFolder);
        }));
 
        // Đọc các file YAML
        const readNotFolders = () =>{
          notFolders.map(item => {
            try {
              const yamlData = fs.readFileSync(`${domainName}/content/${dir}/${item}`, 'utf8');
              const jsonData = yaml.load(yamlData);
              if ('publish' in jsonData ) {
                if (jsonData.publish) {
                  listCate.push(jsonData.category);
                  listTags.push(jsonData.tags);
                }else{
                  var index = notFolders.indexOf(item);
                  if (index > -1) {
                    notFolders.splice(index, 1);
                  }
                  readNotFolders()
                }
              }
    
            } catch (err) {
              console.error(err);
            }
          });
        }
        readNotFolders()
 
        // Chuyển đổi routes từ category và tags
        listCate = convertRoutesVirtual(listCate);
        listTags = convertRoutesVirtual(listTags);
 
        // Thêm các file YAML vào danh sách
        nestedFiles.push(...notFolders.map(file => dir + "/" + file));

        // Thêm category và tags vào nestedFiles
        listCate.forEach((cate) => nestedFiles.push(dir + "/" + 'category/' + cate + '.yml'));
        listTags.forEach((tags) => nestedFiles.push(dir + "/" + 'tags/' + tags + '.yml'));
 
        resolve(nestedFiles);
      });
    });
  };
 
  // Đọc thư mục /content
  fs.readdir(`${domainName}/content`, async (err, files) => {
    if (err) {
      console.log(err);
      return;
    }
 
    let folders = files?.filter(file => !file?.includes(".yml"));
    let nestedFiles = [];
 
    // Đọc tất cả các thư mục cấp cao nhất không đồng bộ
    await Promise.all(folders.map(async folder => {
      const filesInFolder = await getNestedFiles(folder);
      nestedFiles.push(...filesInFolder);
    }));
 
    // Lọc các file YAML
    files = [...files, ...nestedFiles]?.filter(file => file.includes(".yml"));
 
    // Tạo routes từ danh sách file YAML
    const routes = files.map(file => {
      return '/' + file
        .replace('index.yml', '')
        .replace('.yml', '');
    });
 
    // Đọc và sửa file nuxt.config.ts
    fs.readFile(`${domainName}/nuxt.config.ts`, 'utf-8', (err, data) => {
      if (err) return console.error(err)
    
      let content = data
    
      // Replace routes
      content = content.replace(/routes:\s*\[.*?\]/s, `routes: ${JSON.stringify(routes).replaceAll('"', "'")}`)
    
      // Add '~/plugin' to dirs if not present
      const dirsRegex = /dirs:\s*\[([^\]]*)\]/
      content = content.replace(dirsRegex, (match, inner) => {
        if (!inner.includes('~/plugin')) {
          return `dirs: [${inner.trim()}, '~/plugin']`
        }
        return match
      })
    
      // Handle nitro block
      const nitroRegex = /nitro:\s*\{([\s\S]*?)\n\}/m
      const hasNitro = nitroRegex.test(content)
    
      if (hasNitro) {
        content = content.replace(nitroRegex, (match, innerContent) => {
          let newInner = innerContent.trim()
    
          // Add crawlLinks & failOnError if missing
          const prerenderRegex = /prerender:\s*\{([\s\S]*?)\}/m
          if (prerenderRegex.test(newInner)) {
            newInner = newInner.replace(prerenderRegex, (match, prerenderContent) => {
              const hasCrawlLinks = /crawlLinks\s*: /.test(prerenderContent)
              const hasFailOnError = /failOnError\s*:/.test(prerenderContent)

              if (hasCrawlLinks && hasFailOnError) {
                return match
              }

              let updated = prerenderContent.trim()

              if (!hasCrawlLinks) {
                updated = `crawlLinks: false,\n${updated}`
              }
              if (!hasFailOnError) {
                updated = `failOnError: false,\n${updated}`
              }

              return `prerender: {\n${updated}\n}`
            })
          }
    
          // Add hooks if not already present
          if (!/hooks:\s*\{/.test(newInner)) {
            const hooksCode = `hooks: {
              'prerender:done': (result) => {
                result.failedRoutes.forEach((value, index) => {
                  if (value.error) {
                    console.warn(\`Skipping 404 (Document not found) for route: \${value.error?.statusMessage}\`);
                    if (value.error?.statusCode === 404 && value.error?.statusMessage === 'Document not found!') {
                      console.warn(\`Skipping 404 (Document not found) for route: \${value.fileName}\`);
                      result.prerenderedRoutes[index].skip = true;
                      return;
                    }
                    if (value.error?.statusCode === 500 && value.route === '/blog/') {
                      console.warn(\`Skipping 500 error for /blog/ \${value.fileName}\`);
                      result.prerenderedRoutes[index].skip = true;
                      return;
                    }
                    result.prerenderedRoutes[index].skip = false;
                    console.error(\`Error detected on route \${result.prerenderedRoutes[index].route}:\`, value.error);
                    throw value.error;
                  }
                });
              }
            },`
    
            // Add hooks ngay sau prerender (nếu có)
            newInner = newInner.replace(/(prerender:\s*\{[\s\S]*?\})(,?)/, `$1,\n${hooksCode}`)
          }
    
          return `nitro: {\n${newInner}\n}`
        })
      }
    
      // Write result back to nuxt.config.ts
      fs.writeFile(`${domainName}/nuxt.config.ts`, content, 'utf-8', (err) => {
        if (err) {
          console.error(err);
        }
      })
    });
  });
}
 
module.exports = {
  generateRoutes
};
 