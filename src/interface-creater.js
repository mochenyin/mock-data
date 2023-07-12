let subRequest = [];
let subResponse = [];
let jsonCode;
let path;
let indent;
const semicolonEnd = true;

const getRandomNumber = (start, end) =>
  end - Math.ceil((end - start) * Math.random());
const booleanArray = [true, false];

const strArray = ["Overhead","the","albatross","Hangs","motionless","upon","the","air","And","deep","beneath","the","rolling","waves","In","labyrinths","of","coral","caves","The","echo","of","a","distant","time","Comes","willowing","across","the","sand","And","everything","is","green","and","submarine","And","no","one","showed","us","to","the","land","And","no","one","knows","the","where's","or","why's","Something","stirs","and","something","tries","And","starts","to","climb","toward","the","light","Strangers","passing","in","the","street","By","chance","two","separate","glances","meet","And","I","am","you","and","what","I","see","is","me","And","do","I","take","you","by","the","hand","And","lead","you","through","the","land","And","help","me","understand","the","best","I","can","And","no","one","calls","us","to","move","on","And","no","one","forces","down","our","eyes","No","one","speaks","and","no","one","tries","No","one","flies","around","the","sun","Cloudless","everyday","you","fall","Upon","my","waking","eyes","Inviting","and","inciting","me","To","rise","And","through","the","window","in","the","wall","Come","streaming","in","on","sunlight","wings","A","million","bright","ambassadors","of","morning","And","no","one","sings","me","lullabies","And","no","one","makes","me","close","my","eyes","So","I","throw","the","windows","wide","And","call","to","you","across","the","sky"]
const length = 195;
const createMockData = (type) => {
  switch (type) {
    case "boolean":
      return booleanArray[getRandomNumber(0, 1)];
    case "integer":
      return getRandomNumber(0, 100);
    case "number":
      return parseFloat(getRandomNumber(0, 10000)/getRandomNumber(1, 10000)).toFixed(6);
    case "string":
      {
        let str = "";
        new Array(getRandomNumber(0, 30)).fill(0).forEach(() => {
          str += strArray[getRandomNumber(0, 194)] + " ";
        })
        return str;
      }
    default:
      return null;
  }
};

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
  nameList.forEach((v, index) => {
    if (index === 0) {
      interfaceName += v;
      return;
    }
    interfaceName += firstCharUpperCase(v);
  });
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
    mockValue = createMockData(type);
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
  const responsesThirdOriginalRef =
    jsonCode.definitions[keyName] === undefined
      ? {}
      : jsonCode.definitions[keyName];
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
  result = await getCodeFromDefinitions(
    result,
    type,
    interfaceType,
    interfaceName
  );
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
            resultCode = await getCodeFromDefinitions(
              resultCode,
              keyName,
              "request"
            );
          }
        } else {
          rArray.push(await singleItem(item, "request"));
        }
      }
      if (rArray.length) {
        resultCode += `const ${getName(path, "request")}${addLeftBracket}`;
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
