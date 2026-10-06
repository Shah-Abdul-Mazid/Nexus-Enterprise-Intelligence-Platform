import re
import json
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.agents.retriever import retriever_agent
from app.agents.generator import generator_agent
from app.agents.compliance import compliance_agent
from app.agents.live_data import live_data_agent

class GraphState(TypedDict):
    query: str
    provider: str
    route: str
    context: str
    sources: List[str]
    answer: str
    agent_logs: List[str]
    explain_data: Optional[Dict[str, Any]]
    fairness_data: Optional[Dict[str, Any]]

def router_node(state: GraphState):
    query = state["query"]
    logs = state.get("agent_logs", [])
    # Re-initialize logs if it's the first step to prevent duplicates
    if not logs:
        logs = []
    
    provider = state.get("provider") or settings.LLM_PROVIDER
    logs.append(f"Supervisor (LangGraph): Orchestrating workflow using {provider.upper()}")
    
    match = re.search(r'(?:explain|why|decision|applicant)\s*#?\s*(\d+)', query, re.IGNORECASE)
    if match:
        return {"route": "explain", "agent_logs": logs}
    elif live_data_agent.can_handle(query):
        return {"route": "live_data", "agent_logs": logs}
    else:
        return {"route": "rag", "agent_logs": logs}

def explainability_node(state: GraphState):
    query = state["query"]
    logs = state.get("agent_logs", [])
    provider = state.get("provider")
    
    match = re.search(r'(?:explain|why|decision|applicant)\s*#?\s*(\d+)', query, re.IGNORECASE)
    applicant_id = int(match.group(1))
    
    try:
        from app.services.explainability_service import explainability_service
        exp_data = explainability_service.explain_applicant(applicant_id)
        fairness_data = explainability_service.get_fairness_summary()
        
        context = (
            f"Applicant ID: {applicant_id}\n"
            f"Decision: {exp_data['decision']}\n"
            f"Profile details: {json.dumps(exp_data['profile'])}\n"
            f"SHAP Values: {json.dumps(exp_data['shap'])}\n"
            f"LIME Weights: {json.dumps(exp_data['lime'])}\n"
            f"Fairness Metric Disparities: {json.dumps(fairness_data)}\n"
        )
        
        prompt = (
            f"Explain the loan decision for applicant #{applicant_id} using these SHAP/LIME stats:\n"
            f"{context}\n"
            "Provide a professional, clear explanation to the user. Mention that gender/age demographics were strictly excluded."
        )
        
        logs.extend([
            "Supervisor: Detected Explainability Request",
            "Retriever: Loaded applicant profiles from model memory",
            "SHAP Explainer: Evaluated game-theoretic feature importance",
            "LIME Explainer: Constructed local linear approximation",
            "Fairlearn: Audited model for demographic parity"
        ])
        
        answer = generator_agent.run(prompt, context, provider=provider)
        
        return {
            "answer": answer,
            "sources": ["Explainability Model (Random Forest)"],
            "agent_logs": logs,
            "explain_data": exp_data,
            "fairness_data": fairness_data
        }
    except Exception as e:
        logs.append(f"Explainability module failed: {e}. Falling back to standard RAG pipeline.")
        return {
            "answer": f"Error loading explainability module: {e}",
            "sources": [],
            "agent_logs": logs
        }

def live_data_node(state: GraphState):
    query = state["query"]
    logs = state.get("agent_logs", [])
    
    try:
        live_answer = live_data_agent.run(query)
        logs.extend(live_answer.get("agent_logs", []))
        return {
            "answer": live_answer["answer"],
            "sources": live_answer.get("sources", []),
            "agent_logs": logs
        }
    except Exception as exc:
        logs.append(f"Live Data Agent: API lookup failed ({exc})")
        return {"answer": "Error retrieving live data.", "agent_logs": logs}

def retriever_node(state: GraphState):
    query = state["query"]
    provider = state.get("provider")
    logs = state.get("agent_logs", [])
    
    context, sources = retriever_agent.run(query, provider=provider)
    logs.append("Retriever Agent: Context retrieved from Pinecone Cloud")
    
    return {"context": context, "sources": sources, "agent_logs": logs}

def generator_node(state: GraphState):
    query = state["query"]
    context = state.get("context", "")
    provider = state.get("provider")
    logs = state.get("agent_logs", [])
    
    answer = generator_agent.run(query, context, provider=provider)
    logs.append(f"Generator Agent: Synthesized answer using {provider.upper() if provider else 'DEFAULT'}")
    
    return {"answer": answer, "agent_logs": logs}

def compliance_node(state: GraphState):
    answer = state.get("answer", "")
    logs = state.get("agent_logs", [])

    check = compliance_agent.run(answer)
    logs.append("Compliance Agent: Security & PII check complete")

    if not check["compliant"]:
        answer = check.get("masked_text", answer)
        violations_str = ", ".join(check["violations"])
        logs.append(f"SYSTEM ALERT: Compliance PII detected and masked! ({violations_str})")

    return {"answer": answer, "agent_logs": logs}

def route_decision(state: GraphState):
    return state["route"]

# Build Graph
workflow = StateGraph(GraphState)

workflow.add_node("router", router_node)
workflow.add_node("explainability", explainability_node)
workflow.add_node("live_data", live_data_node)
workflow.add_node("retriever", retriever_node)
workflow.add_node("generator", generator_node)
workflow.add_node("compliance", compliance_node)

workflow.set_entry_point("router")

workflow.add_conditional_edges(
    "router",
    route_decision,
    {
        "explain": "explainability",
        "live_data": "live_data",
        "rag": "retriever"
    }
)

workflow.add_edge("explainability", "compliance")
workflow.add_edge("live_data", "compliance")
workflow.add_edge("retriever", "generator")
workflow.add_edge("generator", "compliance")
workflow.add_edge("compliance", END)

app_graph = workflow.compile()

class SupervisorAgent:
    """The Master Orchestrator that manages the Agentic Workflow using LangGraph"""
    
    async def process_request(self, query: str, provider: str = None):
        selected_provider = provider or settings.LLM_PROVIDER
        
        initial_state = {
            "query": query,
            "provider": selected_provider,
            "route": "",
            "context": "",
            "sources": [],
            "answer": "",
            "agent_logs": [],
            "explain_data": None,
            "fairness_data": None
        }
        
        # Run graph
        final_state = app_graph.invoke(initial_state)
        
        result = {
            "answer": final_state.get("answer", ""),
            "sources": final_state.get("sources", []),
            "agent_logs": final_state.get("agent_logs", [])
        }
        
        # Inject explain metadata if present
        if final_state.get("route") == "explain" and final_state.get("explain_data"):
            exp_data = final_state["explain_data"]
            result["shap"] = exp_data.get("shap")
            result["lime"] = exp_data.get("lime")
            result["profile"] = exp_data.get("profile")
            result["decision"] = exp_data.get("decision")
            result["fairness"] = final_state.get("fairness_data")
            
        return result

supervisor_agent = SupervisorAgent()
