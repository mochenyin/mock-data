const jsf = require("json-schema-faker");

let subRequest = [];
let subResponse = [];
let jsonCode;
let path;
let indent;
const semicolonEnd = true;

const createMockData = (type) => (
  {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": type,
  }
);

// 添加缩进
const addIndent = (identNum) => {
  let identStr = "";
  new Array(identNum).fill(1).forEach(() => {
    identStr += " ";
  });
  return identStr;
};

const breakLine = "\n";

const addLeftBracket = ` {${breakLine}`;

const addRightBracket = `}${semicolonEnd ? ";" : ""}${breakLine}${breakLine}`;

const firstCharUpperCase = (v) => v.charAt(0).toLocaleUpperCase() + v.slice(1);

const createInterfaceName = (name) => {
  let interfaceName = "";
  const nameList = name.split("-");
  nameList.forEach((v) => (interfaceName += firstCharUpperCase(v)));
  return interfaceName;
};

const getName = (path, typeName) => {
  const pathArray = path.split("/");
  if (typeName) {
    pathArray.push(typeName);
  }
  const pathStr = pathArray.slice(2).join("-");
  return createInterfaceName(pathStr);
};

const typeMap = {
  integer: "integer",
  string: "string",
  boolean: "boolean",
  number: "number",
};

const singleItem = async (item, interfaceType) => {
  let type = typeMap[item.type];
  let interfaceName = type;
  if (!type) {
    type = item.refType || (item.items ? item.items.originalRef : "");
    interfaceName = type;
    if (!interfaceName) {
      return "";
    }
    const target = interfaceType === "request" ? subRequest : subResponse;
    // if ((/[\u4e00-\u9fa5]/g).test(type)) {
    //     interfaceName = firstCharUpperCase(interfaceType) + target.length;
    // }
    interfaceName = interfaceName.replaceAll("«", "").replaceAll("»", "");
    const code = await createSubInterface(type, interfaceType, interfaceName);
    target.push(code);
  }
  if (item.type === "array") {
    return `${addIndent(indent)}${item.name}: [${interfaceName}],${breakLine}`;
  }
  let mockValue;
  if (typeMap[item.type] === undefined) {
    mockValue = interfaceName;
  } else {
    // @ts-ignore
    mockValue = await jsf.resolve(createMockData(type));
  }
  return `${addIndent(indent)}${item.name}: ${
    item.type === "string" ? `"${mockValue}"` : mockValue
  },${breakLine}`;
};

const getCodeFromDefinitions = async (
  resultCode,
  keyName,
  interfaceType,
  interfaceName
) => {
  const responsesThirdOriginalRef = jsonCode.definitions[keyName] === undefined ? {} : jsonCode.definitions[keyName];
  const target = responsesThirdOriginalRef.properties;
  const responsesArray = Object.keys(target || {});
  if (responsesArray.length) {
    resultCode += `const ${
      interfaceName || getName(path, interfaceType)
    } =${addLeftBracket}`;
    for (let item of responsesArray) {
      target[item].name = item;
      resultCode += await singleItem(target[item], interfaceType);
    }
    resultCode += addRightBracket;
  }
  return resultCode;
};

const createSubInterface = async (type, interfaceType, interfaceName) => {
  let result = "";
  result = await getCodeFromDefinitions(result, type, interfaceType, interfaceName);
  return result;
};

const interfaceCreater = async (code, config) => {
  try {
    subRequest = [];
    subResponse = [];
    jsonCode = JSON.parse(code);
    let resultCode = "";
    path = Object.keys(jsonCode.paths || {})[0];
    if (!path) {
      return { interfaceCode: resultCode, isError: false };
    }
    indent = config.indent;
  
    // 转换请求interface
    const target = jsonCode.paths[path].get || jsonCode.paths[path].post;
    const parameters = target.parameters;
    if (parameters && parameters.length) {
      const rArray = [];
      for (let item of parameters) {
        if (item.schema !== undefined) {
          const keyName = item.schema.originalRef;
          if (keyName) {
            resultCode = await getCodeFromDefinitions(resultCode, keyName, "request");
          }
        } else {
          rArray.push(await singleItem(item, "request"));
        }
      }
      if (rArray.length) {
        resultCode += `const ${getName(
          path,
          "request"
        )}${addLeftBracket}`;
        rArray.forEach((item) => (resultCode += item));
        resultCode += addRightBracket;
      }
    }

    // 转换响应interface
    if (
      target.responses["200"].schema &&
      target.responses["200"].schema.originalRef
    ) {
      const responsesFirstOriginalRef =
        target.responses["200"].schema.originalRef;
      let responsesSecondOriginalRef =
        jsonCode.definitions[responsesFirstOriginalRef].properties.data
          .originalRef;
      if (
        jsonCode.definitions[responsesFirstOriginalRef].properties.data.type ===
        "array"
      ) {
        responsesSecondOriginalRef =
          jsonCode.definitions[responsesFirstOriginalRef].properties.data.items
            .originalRef;
      }
      resultCode = await getCodeFromDefinitions(
        resultCode,
        responsesSecondOriginalRef,
        "response"
      );
    }

    if (subResponse.length) {
      subResponse.forEach((item) => {
        resultCode = item + resultCode;
      });
    }
    if (subRequest.length) {
      subRequest.forEach((item) => {
        resultCode = item + resultCode;
      });
    }
    return { interfaceCode: resultCode, isError: false };
  } catch (e) {
    console.log("error:", e);
    return { interfaceCode: "", isError: true };
  }
};

module.exports = interfaceCreater;