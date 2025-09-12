import documentation from 'documentation';
import { promises as fs } from 'fs';
import path from 'path';

documentation
  .build(['engine/**/*.js', 'editor/**/*.js'], { shallow: true })
  .then(docs => documentation.formats.md(docs))
  .then(md => {
    const outDir = path.resolve('editor/docs');
    return fs.mkdir(outDir, { recursive: true }).then(() => fs.writeFile(path.join(outDir, 'api.md'), md));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
