/* Form Filler – sample files for <input type=file> (200x200 'TEST' images generated with Pillow, PDF built at runtime). */
(() => {
  'use strict';
  const FF = globalThis.__FF;
  if (!FF || FF.makeSampleFile) return;

  const B64 = {
    png: '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',
    jpg: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDLoorsdI0vRP8AhGodR1OD13yb3/vlRwp+lfT1qypJNq99NDyoQc3ZHHUV2P8AxRX+fOo/4or/AD51Y/W/7kvuL9j/AHl95x1Fdj/xRX+fOo/4or/PnUfW/wC5L7g9j/eX3nHUV2P/ABRX+fOo/wCKK/z51H1v+5L7g9j/AHl95x1Fdj/xRX+fOo/4or/PnUfW/wC5L7g9j/eX3nHUV2P/ABRX+fOo/wCKK/z51H1v+5L7g9j/AHl95x1Fdj/xRX+fOo/4or/PnUfW/wC5L7g9j/eX3nHUV2P/ABRX+fOo/wCKK/z51H1v+5L7g9j/AHl95x1Fdj/xRX+fOo/4or/PnUfW/wC5L7g9j/eX3nHUV2P/ABRX+fOo/wCKK/z51H1v+5L7g9j/AHl95x1Fdj/xRX+fOo/4or/PnUfW/wC5L7g9j/eX3nHUV2P/ABRX+fOo1fS9E/4RqbUdMg9Nkm9/74U8MfrQsWrpOLV9NUHsXZtNHHUUUV2GIV2P/NNv8/8APauOrsf+abf5/wCe1ceL+x/iRtR+16M46iiiuwxCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACux/5pt/n/ntXHV2P/NNv8/8APauPF/Y/xI2o/a9GcdRRRXYYhXY/802/z/z2rjq7H/mm3+f+e1ceL+x/iRtR+16M46iiiuwxCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACux/5pt/n/ntXHV2P/NNv8/89q48X9j/ABI2o/a9GcdRRRXYYhXY/wDNNv8AP/PauOrsf+abf5/57Vx4v7H+JG1H7XozjqKKK7DEKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK7H/AJpt/n/ntXHV2P8AzTb/AD/z2rjxf2P8SNqP2vRnHUUUV2GIV2P/ADTb/P8Az2rjq7H/AJpt/n/ntXHi/sf4kbUftejOOooorsMQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArsf+abf5/wCe1cdXY/8ANNv8/wDPauPF/Y/xI2o/a9GcdRRRXYYhXY/802/z/wA9q46ux/5pt/n/AJ7Vx4v7H+JG1H7XozjqKKK7DEKu6Vpk+q3Ztrdo1cIXzISBgY9AfWqVWbG+udPnM9nL5chXbnaDx+NRPm5Xy7jja+uxuf8ACFan/wA97T/vtv8A4mj/AIQrU/8Anvaf99t/8TTdL8R6vcapaQzXe6OSZVYeWgyCee1djrlxLaaPc3Fu+yVEyrYBxz715lWviaU1BtanXCnSkm0noch/whWp/wDPe0/77b/4ms/SNCutXWVraSFREQG8xiOv0BqT/hKdb/5/f/ISf4VueAebe9/31/ka2qTxFKlKU2r6WsZxjTnNKJn/APCFan/z3tP++2/+Jo/4QrU/+e9p/wB9t/8AE1o+LdZ1DTtQhis7jy0aLcRsU85PqKwv+Ep1v/n9/wDISf4VNOWLqRU01qOSoxdmmY1dBpnhO+voVnldLaNhldwyxHrisnTI0l1S0jlwUeZA2fQsK9K1n7b/AGXN/Zv/AB84G3GM4zzjPfFXjMROm4whpfqKjTUk5Poc03gZwPk1FSfeHH9aw9a0W40dohPJG4lztKE9sZzke9Olv9es5Mz3F9Ec/wDLQtj9eKg1HVrzU0hW8dXMO7awUAnOOuPpV0o4hSTlJNEzdO2iszWXwXqTKGE9pgjP32/+Jpf+EK1P/nvaf99t/wDE1SHijWgABe8D/pkn+Fdz4fuprzRLa4uX3yuG3NgDOGI7VzV6uKox5pNGtOFKbskzk/8AhCtT/wCe9p/323/xNZGraXPpNykFy8bMybwYySMZI7gelbGs+ItWtdXuoILvbHHIQq+WhwPxFYd/qF1qMyzXkvmOq7QdoHHXsPeumh9YbUptWMqns1pG9yrRRRXYYhXY/wDNNv8AP/PauOrsf+abf5/57Vx4v7H+JG1H7XozjqKKK7DEK7H/AJpt/n/ntXHV2P8AzTb/AD/z2rjxf2P8SNqP2vRnHUUUV2GIUUUUAXtE/wCQ3Y/9d0/9CFeg+Jf+RfvP9z+orz7RP+Q3Y/8AXdP/AEIV6D4l/wCRfvP9z+orysb/AB6f9dTrofw5HmFdr4B/49rz/fX+Rriq7XwD/wAe15/vr/I104/+A/l+Zlh/4iNfV7vRLe4RdVWAylMr5kBc7c+uD3zWVeaj4WeynWCO180xsExakHdjjnbxU3ibw/d6vexTW0kCqkewiRiDnJPYH1rH/wCEK1P/AJ72n/fbf/E1w0I0OROU2n6nRUdS7Sic2CVYMpIIOQR2rs9M8Zx+UsepROHAx5sYyD7kdvwrlbOBX1SC2mGVadY3weo3YNdRe+CAWLWN3gf3JR0/Ef4V24p0HaNX5GFJVFdwOistW07Uv3dtcxyMRyhGCfwNc74w0S2htP7QtI1iZWAkVRhSD3x2OafovhO5stSiurm5ixEdwWPJJP4gVY8b3sUWliz3AyzMDt7hQc5/PFcFNRhiIqjK66nRJuVNuascFXpfhT/kW7T6N/6Ea80r0vwp/wAi3afRv/QjXXmf8Jev6Mxwvxv0OG8Q/wDIevf+uprNrS8Q/wDIevf+uprNrtpfw4+iMJ/EwooorQkK7H/mm3+f+e1cdXY/802/z/z2rjxf2P8AEjaj9r0Zx1FFFdhiFdj/AM02/wA/89q46ux/5pt/n/ntXHi/sf4kbUftejOOooorsMQooooAkgmkt545oW2yRsGU4zgjpWhc+IdVu7d7e4ut8TjDL5aDP5CsuiolThJ3auNSa0TCr2n6tfaarrZT+UHILfIrZx9RVGinKKkrSV0CbWqNn/hKdb/5/f8AyEn+FH/CU63/AM/v/kJP8KxqKz+r0v5V9yK9pPuxzMzOXJ+YnJPvV631vVLYARX0wA6Bm3AfnWfRWkoRkrNXJTa2NZ/Eusuu1r5gP9lFB/MCsyWWSaQySuzu3VmOSfxplFKNOEPhVgcm92Fadpr+qWdslvbXWyJM7V8tTjJz3FZlFEoRmrSVwUmtiW4nlurh5523SSHLNgDJ/CoqKKpK2iEFFFFMArsf+abf5/57Vx1dj/zTb/P/AD2rjxf2P8SNqP2vRnHUUUV2GIV2P/NNv8/89q46ux/5pt/n/ntXHi/sf4kbUftejOOooorsMQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArsf+abf5/57Vx1dj/zTb/P/PauPF/Y/wASNqP2vRnHUUUV2GIV2P8AzTb/AD/z2rjq7H/mm3+f+e1ceL+x/iRtR+16M46iiiuwxCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACux/wCabf5/57Vx1dj/AM02/wA/89q48X9j/Ejaj9r0Zx1FFFdhiFdj/wA02/z/AM9q46ux/wCabf5/57Vx4v7H+JG1H7XozjqKKK7DEKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK7H/mm3+f8AntXHV2P/ADTb/P8Az2rjxf2P8SNqP2vRnHUUUV2GIV2P/NNv8/8APauOrsdI1TRP+Eah07U5/XfHsf8Avlhyo+lceMTtFpXs09Daja7TfQ46iux/4or/AD51H/FFf586j63/AHJfcHsf7y+846iux/4or/PnUf8AFFf586j63/cl9wex/vL7zjqK7H/iiv8APnUf8UV/nzqPrf8Acl9wex/vL7zjqK7H/iiv8+dR/wAUV/nzqPrf9yX3B7H+8vvOOorsf+KK/wA+dR/xRX+fOo+t/wByX3B7H+8vvOOorsf+KK/z51H/ABRX+fOo+t/3JfcHsf7y+846iux/4or/AD51H/FFf586j63/AHJfcHsf7y+846iux/4or/PnUf8AFFf586j63/cl9wex/vL7zjqK7H/iiv8APnUf8UV/nzqPrf8Acl9wex/vL7zjqK7H/iiv8+dR/wAUV/nzqPrf9yX3B7H+8vvOOrsf+abf5/57Uf8AFFf586jV9U0T/hGptO0yf02R7H/vhjyw+tZVarquCUGrNPVFwgoJttbHHUUUV6JzBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//2Q==',
    gif: 'R0lGODdhyADIAIIAAP////T3/tDe+4ep9GCN8T517TFs7CVj6ywAAAAAyADIAEAI/wAPCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIkSCAjwA6ihxJsmREkCEnojTJsqVLkStVgnxJs6ZNhzEl5rzJs2fNnRCB+hxKtKNQnDOLKl2K8WhDp0yjSkUIdWHVqVilXk24NatXol0Pho0oAKXZs2hRGhBIIK3bjwEOFgjwNm3cgWXr6v241mhSnX9dFkA7gGHbswUmDtgLIMAAAhAHny1Mc2xByxglm6Ws8LDZxCXzohSwUDNKzi4xD1Rt0TRI1Ag9M35tsMAA0XUd92Xo+iNslqwPBP9KHHjgoMeLKx8afPjy5xqbJ4dOPfX0p9erax8p/eP278a9y/8UD768X/Ins5tfDxg9cvfs47dPKb++/fv4Oc7ez7+///8ABiigWxQ5l9933dF34IIeqaeQgQxSl2CEFArnIFcXVrjehBouyGGH+X0I4n0igmibAALQ1VgAKA7wGHQlstQbAL8ZJBtIoEFkwFmkaTRjjSXFaNKPhvkHWWe45ZYjQkRWlqFYT/pIWJGITaTiRwI8VsBaBth2JUpLyjWlk/AhVeaI7AmJ5oZRXtbmms+pCSd4cs65XZ12VodnnjC+uZqffGa1Z6DKJTjgoYgmquii/BHq6KOQRiqpm4xWaumlmPZXIKCTgsUphJ3aNGioTI1KqlKmnurpmQyBqmpLqb7/2lOsst5Ea60/fcoprtaxatWuvIan4HvDBrvUrcYKu6mvyfKEbLMkPQstTLoyOy2ZxZqZ7bW2VrvtRUkC2NeNjN110GL7mXtAuP/ttpG0EjXZGVphOhTukUze1pC8vX77q7Uc8RsbveOh5Bi+FQmsbME1KWyjkUx+uReQBTkcpLcNjzlvlRwZQMAAEoPUY0IWR4sxTSUPRC4A9TYkAMIJoTtaaRr3u6y/IqXM1n+/hbxXAC1XXDOsJ3PLXNFGz4p00t0CDKXTTHO3dNTY3ky1s1NfTTTUlOKsNbVcNxj21xfBSzaxVp9tM8Nqb+01VcC2rW3acl88tkCu1g333Rby/603dnzn/XfXdA+un7eZJq744owa7vjjkEcu+eSUV2755X8yrvnmnO93c+eghw564Zg/ZPbkp0ueeuSrQ9764687Hrvhsw9e+9+365173bvL3Xvbv6sd/NnDk13818drnfzVy1PdfNTPMx190tMbXT2311+b/bTbQ9t9s98nG76x4wdbPq/n4zo7u/6N65+6NrJ/FosEyc+fu9FljZH9+7nfH/wDkdls1MW/2eAvI+tDlP/4A8ADCBAuj+FSAT52G7jUT4Fge9vTNCilyVDpMwXD0kZ0dh4OEg5lQzvIyoKmkBnBLGEpNEnxSLjCidgvSwNgYQtjaDcTis2HF6EhxP8MYoACjuaFTOKhyQIXt4gIsT9IFEgBjHga3ihRakz020SeyJ8oFsRjFawLxaR4xQySTkZlPEANSfJAEe7Qg1Vj20u4CCaTtHFkSYTjS2aYxjVGhC5ZYuFc9JjHzeQqi0BsTR95ZhCf7QWPhaxiHOeTMUIOzD89+58XCULCwyGykoZcyMomlhAwoigAqFwRDg/4xlDuUX+lexAsY7m3RPbNlpdLX610KStevsqXqgLmqYRJKmKGypidQuaklCkpZkbKmZCC5qOk6ShqEsqagcImn7SZJ27ayZtzAiecxLkmcqLJnCNCJ4jU2SF2asidFYInheQZIXoyyJ4emiUtDWIZKNH585+Y+hxAB0rQQ+3zoAhNqEIXKpWAAAA7',
  };
  function bytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Minimal single-page PDF with correct xref offsets (ASCII text only). */
  function makePdf(text) {
    const esc = (s) => s.replace(/[\\()]/g, '\\$&');
    const content = `BT /F1 24 Tf 72 720 Td (${esc(text)}) Tj ET`;
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];
    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((o, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return out;
  }

  const KINDS = [
    { test: /^(\.png|image\/png|image\/\*)$/, make: () => ['test.png', 'image/png', bytes(B64.png)] },
    { test: /^(\.jpe?g|image\/jpe?g|image\/pjpeg)$/, make: () => ['test.jpg', 'image/jpeg', bytes(B64.jpg)] },
    { test: /^(\.gif|image\/gif)$/, make: () => ['test.gif', 'image/gif', bytes(B64.gif)] },
    { test: /^(\.pdf|application\/pdf)$/, make: () => ['test.pdf', 'application/pdf', makePdf('Form Filler test document')] },
    { test: /^(\.txt|text\/plain|text\/\*)$/, make: () => ['test.txt', 'text/plain', 'Form Filler test file.\n'] },
    { test: /^(\.csv|text\/csv)$/, make: () => ['test.csv', 'text/csv', 'id,name,email\n1,Test,test@example.com\n'] },
    { test: /^(\.json|application\/json)$/, make: () => ['test.json', 'application/json', '{"test": true}\n'] },
    { test: /^(\.xml|text\/xml|application\/xml)$/, make: () => ['test.xml', 'application/xml', '<?xml version="1.0"?><test>true</test>\n'] },
    { test: /^(\.svg|image\/svg\+xml)$/, make: () => ['test.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#2563eb"/></svg>\n'] },
  ];

  /** Build a File that satisfies the input's `accept` attribute (PDF when unrestricted). */
  FF.makeSampleFile = function (accept) {
    const tokens = String(accept || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    let spec = null;
    for (const t of tokens.length ? tokens : ['.pdf']) {
      const k = KINDS.find((x) => x.test.test(t));
      if (k) {
        spec = k.make();
        break;
      }
    }
    if (!spec) {
      // Unknown type (e.g. .docx, video/*): plain-text payload with an accepted extension.
      const ext = tokens.find((t) => t.startsWith('.')) || '.txt';
      const mime = tokens.find((t) => t.includes('/') && !t.endsWith('/*')) || '';
      spec = [`test${ext}`, mime, 'Form Filler test file.\n'];
    }
    const [name, type, data] = spec;
    return new File([data], name, { type, lastModified: Date.now() });
  };
})();
