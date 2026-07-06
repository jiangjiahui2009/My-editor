"""
我的主编 — Flask 后端服务
提供页面服务和 /api/analyze 接口，代理 LLM API 调用。
"""
import logging
from flask import Flask, render_template, request, jsonify, send_from_directory
import requests
from dotenv import load_dotenv

load_dotenv()

from prompts.editor_prompt import build_system_prompt, build_rewrite_prompt, STYLES, REWRITE_MESSAGE_TEMPLATE

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)


def _normalize_endpoint(endpoint):
    endpoint = endpoint.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint += "/chat/completions"
    return endpoint


# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "请求数据为空"}), 400

    article = data.get("article", "").strip()
    if not article:
        return jsonify({"error": "请先粘贴文章内容"}), 400

    article_type = data.get("article_type", "auto")

    config = data.get("config", {})
    endpoint = config.get("endpoint", "").strip()
    api_key = config.get("api_key", "").strip()
    model = config.get("model", "").strip()

    if not endpoint or not api_key or not model:
        return jsonify({"error": "请先在设置中配置 API 地址、密钥和模型名称"}), 400

    endpoint = _normalize_endpoint(endpoint)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": build_system_prompt(article_type)},
            {"role": "user", "content": f"请分析以下文章：\n\n---\n\n{article}"},
        ],
        "temperature": 0.7,
    }

    app.logger.info(f"Calling LLM: {endpoint} model={model} article_len={len(article)}")

    try:
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=120)

        if resp.status_code in (401, 403):
            return jsonify({"error": f"API 认证失败 ({resp.status_code})：请检查 API 密钥是否正确"}), 401

        if resp.status_code >= 500:
            body = resp.text[:300]
            return jsonify({"error": f"API 服务异常 ({resp.status_code})：{body}"}), 502

        if resp.status_code != 200:
            body = resp.text[:300]
            return jsonify({"error": f"API 返回错误 ({resp.status_code})：{body}"}), resp.status_code

        result = resp.json()
        content = (
            result.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        if not content:
            return jsonify({"error": "API 返回内容为空，请重试"}), 500

        sections = _parse_sections(content)

        return jsonify({"sections": sections, "raw": content})

    except requests.exceptions.Timeout:
        return jsonify({"error": "分析超时（120 秒），请检查 API 地址是否可访问，或尝试缩短文章"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "无法连接到 API 地址，请检查网络和 API 地址是否正确"}), 502
    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        return jsonify({"error": f"请求异常：{str(e)}"}), 500


@app.route("/api/rewrite", methods=["POST"])
def rewrite():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "请求数据为空"}), 400

    article = data.get("article", "").strip()
    if not article:
        return jsonify({"error": "请先粘贴文章内容"}), 400

    style = data.get("style", "yu_hua")
    custom_desc = data.get("style_desc", "").strip()
    custom_name = data.get("style_name", "").strip()

    if not custom_desc and style not in STYLES:
        return jsonify({"error": f"不支持的风格：{style}"}), 400

    config = data.get("config", {})
    endpoint = config.get("endpoint", "").strip()
    api_key = config.get("api_key", "").strip()
    model = config.get("model", "").strip()

    if not endpoint or not api_key or not model:
        return jsonify({"error": "请先在设置中配置 API 地址、密钥和模型名称"}), 400

    endpoint = _normalize_endpoint(endpoint)

    system_prompt = build_rewrite_prompt(style, custom_desc=custom_desc, custom_name=custom_name)
    display_name = custom_name or STYLES.get(style, "余华")
    user_message = REWRITE_MESSAGE_TEMPLATE.format(
        style=display_name, article=article
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.8,
    }

    app.logger.info(f"Rewrite: {endpoint} model={model} style={display_name} len={len(article)}")

    try:
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=120)

        if resp.status_code in (401, 403):
            return jsonify({"error": f"API 认证失败 ({resp.status_code})：请检查 API 密钥是否正确"}), 401

        if resp.status_code >= 500:
            body = resp.text[:300]
            return jsonify({"error": f"API 服务异常 ({resp.status_code})：{body}"}), 502

        if resp.status_code != 200:
            body = resp.text[:300]
            return jsonify({"error": f"API 返回错误 ({resp.status_code})：{body}"}), resp.status_code

        result = resp.json()
        content = (
            result.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        if not content:
            return jsonify({"error": "API 返回内容为空"}), 500

        return jsonify({"content": content})

    except requests.exceptions.Timeout:
        return jsonify({"error": "改写超时，请重试"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "无法连接到 API 地址"}), 502
    except Exception as e:
        app.logger.error(f"Rewrite error: {e}")
        return jsonify({"error": f"请求异常：{str(e)}"}), 500


# --- Helpers ---

def _parse_sections(content):
    """将 LLM 返回内容按 ## 一、/ 二、/ 三、/ 四、 拆分为 4 个 section。"""
    markers = ["## 一、", "## 二、", "## 三、", "## 四、"]
    titles = ["整体总结", "评价反馈", "细节纠错", "延伸思考"]

    # Find positions of each marker
    positions = [content.find(m) for m in markers]

    sections = []
    for i, (_, title) in enumerate(zip(markers, titles)):
        pos = positions[i]
        if pos == -1:
            sections.append({
                "title": title,
                "content": f"## {title}\n\n（模型未生成此部分内容，请重试）",
            })
        else:
            end = len(content)
            for j in range(i + 1, len(markers)):
                if positions[j] > pos:
                    end = positions[j]
                    break
            section_content = content[pos:end].strip()
            sections.append({"title": title, "content": section_content})

    return sections


@app.route("/icon/<path:filename>")
def serve_icon(filename):
    return send_from_directory("icon", filename)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
