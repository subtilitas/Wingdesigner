// Errors of the XFLR5 readers (src/import/xfl.js for .xfl projects, the XML reader for plane files).
//
// A file-level error means the file cannot be imported at all: Open shows `Cannot open {name}: …` with
// the message and keeps the current design. The code says what went wrong, for callers and tests:
//   'not-xflr5'      not an XFLR5 project (unknown first number)
//   'flow5'          a flow5 project (.fl5) or flow5 plane file
//   'wpa'            a .wpa project of XFLR5 6.09 and older (little-endian)
//   'damaged'        cut off or inconsistent: at byte `offset` in an .xfl project; in an XML file
//                    `offset` is null and the message names the line (also an invalid length unit)
//   'not-plane-xml'  XML whose root is not <explane version="1.0">
//   'no-plane'       the file holds no plane
//   'fin'            an XML wing-only file that holds a fin
//   'too-large'      larger than the readers accept (file size, planes, sections)

/** File-level error of an XFLR5 reader: `code` as listed above, `message` the translated text for the user. */
export class XflrError extends Error {
  /**
   * @param {string} code
   * @param {string} message translated, shown after "Cannot open {name}: "
   * @param {number|null} [offset] byte offset of the damage in an .xfl project; null for XML files and
   *   where it does not apply
   */
  constructor(code, message, offset = null) {
    super(message);
    this.name = 'XflrError';
    this.code = code;
    this.offset = offset;
  }
}
