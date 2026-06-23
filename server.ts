import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

// Define port & host
const PORT = 3000;
const HOST = "0.0.0.0";

// Lazy initialize Gemini clients
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("WARNING: GEMINI_API_KEY is not configured or uses placeholder.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Endpoints
  app.post("/api/decompose", async (req, res) => {
    try {
      const { kanji, preferredPartsCount } = req.body;
      if (!kanji || typeof kanji !== "string") {
        return res.status(400).json({ success: false, error: "文字が入力されていません。" });
      }

      const inputChar = kanji.trim();
      if (inputChar.length === 0) {
        return res.status(400).json({ success: false, error: "正しい漢字を入力してください。" });
      }

      const ai = getAiClient();
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
        return res.status(400).json({
          success: false,
          error: "Gemini APIキーが設定されていません。AI機能を利用するには、画面上部・設定等のシークレット設定で GEMINI_API_KEY を設定してください。"
        });
      }

      // Structure system instructions and prompt
      let systemInstruction = 
        "あなたは日本語（漢字、部首、部首分解、漢字パズル）の専門家です。 " +
        "入力された漢字（または文字列）を、漢字バラバラクイズに使用できるように「構成パーツ」へと高精度に分解します。 " +
        "構成パーツは、日本の常用漢字やJIS漢字コードに含まれている、それぞれ個別の文字（偏・旁、おなじみの漢字、部首、カタカナ等）として綺麗に表示・書き出せる単体パーツでなければなりません。 " +
        "例えば、「語」は [\"言\", \"五\", \"口\"] に分解します。「働」は [\"人\", \"重\", \"力\"]（にんべんは『人』に置き換えるなど）に分解します。 " +
        "難しい漢字「鬱」であれば [\"木\", \"缶\", \"木\", \"冖\", \"鬯\", \"彡\"] のようなパーツに分解します。 " +
        "また、その漢字の「音読み（カタカナ。なければ空文字列）」と「訓読み（送り仮名も含めてひらがな。なければ空文字列）」を個別かつ明確に切り出してください。 " +
        "さらに、その漢字を含む代表的な「単語・語彙（熟語・言葉）」を2〜3個提案してください。 ※最重要※ 提案する単語に使われている『すべての漢字』は、必ずその漢字が属する学年（難易度）以下の学年で習う漢字、および、ひらがな・カタカナ文字のみで構成してください。例えば小学2年用の『新』であれば、1〜2年で習う漢字を使った『新年』『しんねん』『新しい』『あたらしい』『新聞』『しんぶん』はOKですが、5年で習う幹を含む『新幹線』は、小学2年生がまだ習っていない漢字を含んでいるため『絶対に入れないでください』。 " +
        "ユーザーに楽しんでもらえる魅力的なヒント、意味、読み、その漢字が日本の小学校の何年生で習うか（あるいは一般・その他か）に応じた学年・難易度（'grade1' | 'grade2' | 'grade3' | 'grade4' | 'grade5' | 'grade6' | 'other'）も一緒に提案してください。";

      if (preferredPartsCount && typeof preferredPartsCount === "number" && preferredPartsCount > 0) {
        systemInstruction += ` ※最重要要件※ 今回は、この漢字を『確実に合計 ${preferredPartsCount} 個』のパーツに分割してください。パーツ数が必ず ${preferredPartsCount}個に一致するよう、適度にまとめたりカタカナ等に細かく分割して個数を調整してください。`;
      }

      const prompt = `分解対象の漢字: 「${inputChar}」` + (preferredPartsCount ? ` (希望するパーツ数: ${preferredPartsCount}個)` : "");

      // Call Gemini 3.5-flash with JSON schema as specified in gemini-api skill
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kanji: {
                type: Type.STRING,
                description: "元の漢字（例:「語」）"
              },
              parts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "漢字を構成するパーツの配列。画面にバラバラにして表示されるため、個別の漢字・記号・部首・カタカナに分解してください。（例:「言」「五」「口」）"
              },
              reading: {
                type: Type.STRING,
                description: "音読み・訓読みを合わせた簡易表記（例:「ゴ、かたる」）"
              },
              onyomi: {
                type: Type.STRING,
                description: "明確な音読み。カタカナで表記します（例:「ゴ」）"
              },
              kunyomi: {
                type: Type.STRING,
                description: "明確な訓読み。ひらがなで表記し、送り仮名も含めます（例:「かた-る」）"
              },
              exampleWords: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: {
                      type: Type.STRING,
                      description: "提案する熟語・単語。必ず該当の学年漢字（またはそれ未満の低学年漢字）と「かな」だけで構成します。"
                    },
                    reading: {
                      type: Type.STRING,
                      description: "その単語・熟語 of ひらがな読み仮名"
                    },
                    meaning: {
                      type: Type.STRING,
                      description: "その単語・熟語の子供向けの短い意味説明"
                    }
                  },
                  required: ["word", "reading"]
                },
                description: "その漢字が習われる学年以下の漢字のみで構成された、その漢字を使った言葉のリスト"
              },
              meaning: {
                type: Type.STRING,
                description: "漢字一文字の子供向けの短い意味説明（例:「お話すること、言葉、まじわること」）"
              },
              hint: {
                type: Type.STRING,
                description: "子供たちがこのパズルの元の漢字を連想しやすくなる面白いヒント（例:「お話しするときに使う言葉に関係あるよ！」）"
              },
              difficulty: {
                type: Type.STRING,
                description: "漢字パズルの難易度（例: 'medium'）"
              }
            },
            required: ["kanji", "parts", "reading", "meaning", "hint"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("AIから有効な応答が得られませんでした。");
      }

      const generatedData = JSON.parse(responseText);

      // Adjust parts count if preferredPartsCount is specified
      let finalParts = generatedData.parts || [];
      if (preferredPartsCount && typeof preferredPartsCount === "number" && preferredPartsCount > 0) {
        finalParts = adjustPartsCountHelper(finalParts, preferredPartsCount);
      }

      res.json({
        success: true,
        kanji: generatedData.kanji || inputChar,
        parts: finalParts,
        reading: generatedData.reading || "",
        meaning: generatedData.meaning || "",
        hint: generatedData.hint || "",
        difficulty: generatedData.difficulty || "medium"
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message || "内部サーバーエラーが発生しました。" });
    }
  });

  function adjustPartsCountHelper(baseParts: string[], N: number): string[] {
    if (baseParts.length === N) return baseParts;

    const microSplit: Record<string, string[]> = {
      '言': ['亠', '二', '口'],
      '重': ['千', '里'],
      '里': ['田', '土'],
      '木': ['十', '八'],
      '金': ['人', '王', '丷'],
      '雨': ['一', '冖', '巾', '⺀'],
      '青': ['丰', '月'],
      '泉': ['白', '水'],
      '祖': ['礻', '且'],
      '吉': ['士', '口'],
      '古': ['十', '口'],
      '吾': ['五', '口'],
      '員': ['口', '貝'],
      '常': ['⺌', '冖', '口', '巾'],
      '堂': ['⺌', '冖', '口', '土'],
      '党': ['⺌', '冖', '口', '儿'],
      '賞': ['⺌', '冖', '口', '貝'],
      '掌': ['⺌', '冖', '口', '手'],
      '意': ['立', '日', '心'],
      '億': ['人', '意'],
      '競': ['立', '兄', '立', '兄'],
      '章': ['立', '早'],
      '童': ['立', '里'],
      '新': ['立', '木', '斤'],
      '親': ['立', '木', '見'],
      '駅': ['馬', '尺'],
      '験': ['馬', '誠'],
      '馬': ['𦾓', '灬'],
      '鳥': ['𠂉', '⿅', '灬'],
      '魚': ['ク', '田', '灬'],
      '黒': ['里', '灬'],
      '点': ['占', '灬'],
      '然': ['夕', '犬', '灬'],
      '無': ['𠂉', '一', '𦾏', '灬'],
      '熱': ['土', '丸', '灬'],
      '照': ['昭', '灬'],
      '春': ['三', '人', '日'],
      '夏': ['一', '自', '夂'],
      '秋': ['禾', '火'],
      '冬': ['夂', '冫'],
      '東': ['木', '日'],
      '交': ['亠', '父'],
      '毎': ['𠂉', '母'],
      '糸': ['幺', '小'],
      '貝': ['目', 'ハ'],
      '頁': ['一', '自', 'ハ'],
      '音': ['立', '日'],
      '画': ['一', '由', '凵'],
      '海': ['氵', '毎'],
      '池': ['氵', '也'],
      '洋': ['氵', '羊'],
      '湯': ['氵', '昜'],
      '温': ['氵', '温'],
      '洗': ['氵', '先'],
      '活': ['氵', '舌'],
      '泳': ['氵', '永'],
      '油': ['氵', '由'],
      '治': ['氵', '台'],
      '法': ['氵', '去'],
      '波': ['氵', '皮'],
      '沿': ['氵', '㕣'],
      '消': ['氵', '肖'],
      '林': ['木', '木'],
      '森': ['木', '林'],
      '校': ['木', '交'],
      '村': ['木', '寸'],
      '休': ['人', '木'],
      '体': ['人', '本'],
      '何': ['人', '可'],
      '作': ['人', '乍'],
      '信': ['人', '言'],
      '男': ['田', '力'],
      '明': ['日', '月'],
      '暗': ['日', '音'],
      '好': ['女', '子'],
      '妹': ['女', '未'],
      '姉': ['女', '市'],
      '始': ['女', '台'],
      '岩': ['山', '石'],
      '間': ['門', '日'],
      '聞': ['門', '耳'],
      '問': ['門', '口'],
      '開': ['門', '幵'],
      '語': ['言', '吾'],
      '話': ['言', '舌'],
      '読': ['言', '売'],
      '計': ['言', '十'],
      '記': ['言', '己'],
      '可': ['丁', '口'],
      '袁': ['土', '衣'],
      '乍': ['𠂉', '二', '丨'],
      '𠂊': ['勹', '丶'],
      '占': ['卜', '口'],
      '电': ['日', '乚'],
      '毋': ['女', '一'],
      '巴': ['己', '丨'],
      '婁': ['母', '女'],
      '㕣': ['八', '口'],
      '昜': ['日', '勿'],
      '隹': ['隹'],
      '完': ['宀', '元'],
      '咸': ['戌', '口'],
      '官': ['宀', '口'],
      '各': ['夂', '口'],
      '及': ['丿', '𠂊'],
      '呂': ['口', '口'],
      '且': ['月', '一'],
      '系': ['丿', '糸'],
      '圣': ['又', '土'],
      '夬': ['ユ', '人'],
      '吏': ['一', '史'],
      '旨': ['匕', '日'],
      '与': ['一', '丂'],
      '良': ['丶', '艮'],
      '聿': ['ヨ', '十'],
      '者': ['耂', '日'],
      '肖': ['⺌', '月'],
      '疋': ['𠂉', '人'],
      '也': ['フ', '乚'],
      'ホ': ['十', '八'],
      '旦': ['日', '一'],
      '弔': ['弓', '丨'],
      '由': ['日', '丨'],
      '釆': ['丿', '米'],
      '几': ['丿', '乙'],
      '丬': ['冫', '丨'],
      'ヒ': ['丿', '乚'],
      '未': ['一', '木'],
      '予': ['マ', '了'],
    };

    const strokeSplits: Record<string, string[]> = {
      '口': ['冂', '一'],
      '日': ['冂', '二'],
      '月': ['冂', '二'],
      '田': ['囗', '十'],
      '目': ['冂', '三'],
      '女': ['く', 'ノ', '一'],
      '子': ['了', '一'],
      '手': ['𠂉', '一', '亅'],
      '人': ['ノ', '乀'],
      '入': ['ノ', '乀'],
      '八': ['丿', '乀'],
      '九': ['丿', '乙'],
      '力': ['フ', '丿'],
      '刀': ['フ', '丿'],
      '又': ['㇇', '乀'],
      '寸': ['十', '丶'],
      '工': ['丅', '一'],
      '夕': ['ク', '丶'],
      '土': ['十', '一'],
      '木': ['十', '八'],
      '火': ['丷', '人'],
      '山': ['凵', '丨'],
      '石': ['厂', '口'],
      '川': ['丿', '丨', '丨'],
      '天': ['二', '人'],
      '立': ['亠', '丷', '一'],
      '心': ['丶', '乚', '丷'],
      '言': ['亠', '二', '口'],
      '貝': ['目', 'ハ'],
      '門': ['𨳽', '𨳼'],
      '車': ['十', '日', '十'],
      '糸': ['幺', '小'],
      '金': ['人', '王', '丷'],
      '雨': ['一', '冖', '巾', '⺀'],
      '竹': ['个', '个'],
      '米': ['丷', '木'],
      '食': ['人', '良'],
    };

    if (baseParts.length > N) {
      const result = [...baseParts];
      while (result.length > N) {
        const p1 = result.shift()!;
        const p2 = result.shift()!;
        result.unshift(p1 + p2);
      }
      return result;
    } else {
      let result = [...baseParts];
      let attempts = 0;
      while (result.length < N && attempts < 30) {
        attempts++;
        let splitIndex = -1;
        let replacement: string[] = [];

        // 1. Try to find a part that has length > 1
        for (let i = 0; i < result.length; i++) {
          if (result[i].length > 1) {
            splitIndex = i;
            replacement = result[i].split('');
            break;
          }
        }

        // 2. Try to find a part in microSplit
        if (splitIndex === -1) {
          for (let i = 0; i < result.length; i++) {
            if (microSplit[result[i]]) {
              splitIndex = i;
              replacement = microSplit[result[i]];
              break;
            }
          }
        }

        // 3. Fallback: split the first single character part using strokeSplits
        if (splitIndex === -1) {
          for (let i = 0; i < result.length; i++) {
            if (result[i].length === 1 && strokeSplits[result[i]]) {
              splitIndex = i;
              replacement = strokeSplits[result[i]];
              break;
            }
          }
        }

        if (splitIndex !== -1) {
          result.splice(splitIndex, 1, ...replacement);
        } else {
          // 4. Force a split of single-character item into [item, '丶'] to increase count by exactly 1
          let found = false;
          for (let i = 0; i < result.length; i++) {
            if (result[i].length === 1 && result[i] !== '丶' && result[i] !== '一' && result[i] !== '丨') {
              const charToSplit = result[i];
              result.splice(i, 1, charToSplit, '丶');
              found = true;
              break;
            }
          }
          if (!found) {
            if (result.length > 0) {
              result.push('丶');
            }
            break;
          }
        }
      }

      // Double check: if result.length is still not equal to N, force it
      if (result.length > N) {
        while (result.length > N) {
          const p1 = result.shift()!;
          const p2 = result.shift()!;
          result.unshift(p1 + p2);
        }
      } else if (result.length < N) {
        while (result.length < N) {
          result.push('丶');
        }
      }

      return result;
    }
  }

  // Serve static paths/Vite compiler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
}

startServer();
