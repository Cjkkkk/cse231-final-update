
import { assert } from "chai";
import { BinOp, Expr, Stmt, Type, UniOp, TypeDef, Primitive, Const, FuncStmt, VarStmt } from "./ast";
type FuncType = [Type[], Type];
type FunctionsEnv = Map<string, FuncType>[];
type VariablesEnv = Map<string, Type>[];
type ClassesEnv = Map<string, Map<string, FuncType | Type>>;


function getCurrentVariableScope(variables : VariablesEnv): Map<string, Type> {
    assert(variables.length > 0);
    return variables[variables.length - 1];
}

function getCurrentFunctionScope(functions : FunctionsEnv): Map<string, [Type[], Type]> {
    assert(functions.length > 0);
    return functions[functions.length - 1];
}


function enterNewVariableScope(variables : VariablesEnv): VariablesEnv {
    variables.push(new Map<string, Type>());
    return variables;
}


function exitCurrentVariableScope(variables : VariablesEnv): VariablesEnv {
    variables.pop();
    return variables;
}


function enterNewFunctionScope(functions : FunctionsEnv): FunctionsEnv {
    functions.push(new Map<string, [Type[], Type]>());
    return functions;
}

function exitCurrentFunctionScope(functions : FunctionsEnv): FunctionsEnv {
    functions.pop();
    return functions;
}


function lookUpVar(variables : VariablesEnv, name: string, current: boolean): [boolean, Type] {
    var end = current? variables.length - 1: 0;
    for(var i = variables.length - 1; i >= end; i --) {
        if(variables[i].has(name)) return [true, variables[i].get(name)];
    }
    // throw new Error(`Reference error: variable ${name} is not defined`)
    return [false, Primitive.None];
}


function defineNewVar(variables : VariablesEnv, name: string, type: Type) {
    let [found, t] = lookUpVar(variables, name, true);
    if (found) {
        throw new Error("Redefine variable: " + name);
    } else {
        getCurrentVariableScope(variables).set(name, type);
    }
}

function lookUpFunc(functions: FunctionsEnv, name: string, current: boolean): [boolean, [Type[], Type]] {
    var end = current? functions.length - 1: 0;
    for(var i = functions.length - 1; i >= end; i --) {
        if(functions[i].has(name)) return [true, functions[i].get(name)];
    }
    return [false, [[], Primitive.None]];
}


function defineNewFunc(functions: FunctionsEnv, name: string, sig: [Type[], Type]) {
    let [found, t] = lookUpFunc(functions, name, true);
    if (found) {
        throw new Error("Redefine function: " + name);
    } else {
        getCurrentFunctionScope(functions).set(name, sig);
    }
}


export function didAllPathReturn(stmts: Stmt<any>[]): boolean {
    return stmts.some( s => (s.tag == "return") || (s.tag == "if") && didAllPathReturn(s.if.body) && didAllPathReturn(s.else) && (s.elif.every((e => didAllPathReturn(e.body)))));
}


export function tcExpr(e : Expr<any>, functions : FunctionsEnv, variables : VariablesEnv) : Expr<Type> {
    switch(e.tag) {
        case "literal":
            if( e.value == Const.None) {
                return { ...e, a: Primitive.Int };
            } else if (e.value == Const.True) {
                return { ...e, a: Primitive.Bool }; 
            } else if (e.value == Const.False) {
                return { ...e, a: Primitive.Bool };
            } else {
                return { ...e, a: Primitive.Int };
            }
        case "binary": {
            const lhs = tcExpr(e.lhs, functions, variables);
            const rhs = tcExpr(e.rhs, functions, variables);
            switch(e.op) {
                case BinOp.Plus: 
                case BinOp.Minus:
                case BinOp.Mul:
                case BinOp.Div: 
                case BinOp.Mod:
                    if (lhs.a != Primitive.Int || rhs.a != Primitive.Int) {
                        throw new TypeError(`Expected type INT but got type ${lhs.a} and type ${rhs.a}`)
                    }
                    return { ...e, a: Primitive.Int, lhs, rhs};
                case BinOp.Equal:
                case BinOp.Unequal:
                    if (lhs.a != rhs.a) {
                        throw new TypeError(`Expected lhs and rhs to be same type but got type ${lhs.a} and type ${rhs.a}`)
                    }
                    return { ...e, a: Primitive.Bool, lhs, rhs};
                case BinOp.Gt: 
                case BinOp.Ge:
                case BinOp.Lt:
                case BinOp.Le:
                    if (lhs.a != Primitive.Int || rhs.a != Primitive.Int) {
                        throw new TypeError(`Expected type INT but got type ${lhs.a} and type ${rhs.a}`)
                    }
                    return { ...e, a: Primitive.Bool, lhs, rhs };
                case BinOp.Is: 
                    // todo: fix this
                    return { ...e, a: Primitive.Bool, lhs, rhs };
            }
        }

        case "unary": {
            const expr = tcExpr(e.expr, functions, variables);
            switch(e.op) {
                case UniOp.Not: 
                    if (expr.a != Primitive.Bool) {
                        throw new TypeError(`Expected type BOOL but got type ${expr.a}`)
                    }
                    return { ...e, a: Primitive.Bool, expr: expr };
                case UniOp.Neg: 
                    if (expr.a != Primitive.Int) {
                        throw new TypeError(`Expected type INT but got type ${expr.a}`)
                    }
                    return { ...e, a: Primitive.Int, expr: expr };
            }
        }
        case "name": {
            let [found, t] = lookUpVar(variables, e.name, false);
            if (!found) {
                throw new ReferenceError(`Reference error: ${e.name} is not defined`)
            }
            return { ...e, a: t};
        }
        case "call":
            if(e.name === "print") {
                if(e.args.length !== 1) { throw new Error("print expects a single argument"); }
                const newArgs = [tcExpr(e.args[0], functions, variables)];
                const res : Expr<Type> = { ...e, a: Primitive.None, args: newArgs } ;
                return res;
            }
            let [found, t] = lookUpFunc(functions, e.name, false);
            if(!found) {
                throw new ReferenceError(`function ${e.name} is not defined`);
            }

            const [args, ret] = t;
            if(args.length !== e.args.length) {
                throw new Error(`Expected ${args.length} arguments but got ${e.args.length}`);
            }

            const newArgs = args.map((a, i) => {
                const argtyp = tcExpr(e.args[i], functions, variables);
                if(a !== argtyp.a) { throw new TypeError(`Got ${argtyp.a} as argument ${i + 1}, expected ${a}`); }
                return argtyp
            });

            return { ...e, a: ret, args: newArgs };
    }
}

export function tcFuncStmt(s : FuncStmt<any>, functions : FunctionsEnv, variables : VariablesEnv, currentReturn : Type) : FuncStmt<Type> {
    if (s.ret !== Primitive.None && !didAllPathReturn(s.body)) {
        throw new Error(`All path in function ${s.name} must have a return statement`);
    }
    functions = enterNewFunctionScope(functions);
    variables = enterNewVariableScope(variables);

    // define param
    s.params.forEach(p => defineNewVar(variables, p.name, p.type));

    // define local variables and functions
    s.body.forEach(s => {
        if (s.tag == "func") defineNewFunc(functions, s.name, [s.params.map(p => p.type), s.ret]);
        else if (s.tag == "var") defineNewVar(variables, s.var.name, s.var.type);
    })

    checkDefinition(s.body);
    const newBody = s.body.map(bs => tcStmt(bs, functions, variables, s.ret));
    
    exitCurrentFunctionScope(functions);
    exitCurrentVariableScope(variables);
    return { ...s, body: newBody };
}


export function tcVarStmt(s : VarStmt<any>, functions : FunctionsEnv, variables : VariablesEnv, currentReturn : Type) : VarStmt<Type> {
    const rhs = tcExpr(s.value, functions, variables);
    if ( rhs.tag != "literal") {
        throw new Error(`can only initialize variable with literal`);
    }
    if ( rhs.a != s.var.type) {
        throw new TypeError(`Incompatible type when initializing variable ${s.var.name} of type ${s.var.type} using type ${rhs.a}`)
    }
    return { ...s, value: rhs };
}


export function tcStmt(s : Stmt<any>, functions : FunctionsEnv, variables : VariablesEnv, currentReturn : Type) : Stmt<Type> {
    switch(s.tag) {
        case "func": {
            return tcFuncStmt(s, functions, variables, currentReturn);
        }

        case "var": {
            return tcVarStmt(s, functions, variables, currentReturn);
        }

        case "class": {
            const fields = s.fields.map((v)=>tcVarStmt(v, functions, variables, currentReturn)); //TODO: pass class info
            const methods = s.methods.map((v)=>tcFuncStmt(v, functions, variables, currentReturn));
            return {
                ...s,
                fields,
                methods
            }
        }

        case "assign": {
            const rhs = tcExpr(s.value, functions, variables);
            const [found, t] = lookUpVar(variables, s.name, true);
            if (!found) {
                throw new ReferenceError(`Reference error: ${s.name} is not defined`);
            }
            if( t !== rhs.a) {
                throw new TypeError(`Cannot assign ${rhs.a} to ${t}`);
            }
            
            return { ...s, value: rhs };
        }

        case "if": {
            const newIfCond = tcExpr(s.if.cond, functions, variables);
            if(newIfCond.a != Primitive.Bool) {
                throw new TypeError("Expect type BOOL in condition")
            }
            // functions = enterNewFunctionScope(functions);
            // variables = enterNewVariableScope(variables);
            const newIfBody = s.if.body.map(bs => tcStmt(bs, functions, variables, currentReturn));

            // exitCurrentFunctionScope(functions);
            // exitCurrentVariableScope(variables);

            const newElif = s.elif.map(bs => {
                let cond = tcExpr(bs.cond, functions, variables);
                if(cond.a != Primitive.Bool) {
                    throw new TypeError("Expect type BOOL in condition")
                }
                // functions = enterNewFunctionScope(functions);
                // variables = enterNewVariableScope(variables);

                let body = bs.body.map(bb => tcStmt(bb, functions, variables, currentReturn))

                // exitCurrentFunctionScope(functions);
                // exitCurrentVariableScope(variables);
                return {
                    cond: cond, 
                    body: body
                }});
            
            // functions = enterNewFunctionScope(functions);
            // variables = enterNewVariableScope(variables);
            
            const newElseBody = s.else.map(bs => tcStmt(bs, functions, variables, currentReturn));

            // exitCurrentFunctionScope(functions);
            // exitCurrentVariableScope(variables);

            return {...s, if: {cond: newIfCond, body: newIfBody}, elif: newElif, else: newElseBody}
        }

        case "while": {
            const newCond = tcExpr(s.while.cond, functions, variables);
            if(newCond.a != Primitive.Bool) {
                throw new TypeError("Expect type BOOL in condition")
            }
            // functions = enterNewFunctionScope(functions);
            // variables = enterNewVariableScope(variables);

            const newBody = s.while.body.map(bs => tcStmt(bs, functions, variables, currentReturn));

            // exitCurrentFunctionScope(functions);
            // exitCurrentVariableScope(variables);
            return { ...s, while: {cond: newCond, body: newBody}};
        }

        case "pass": {
            return s;
        }
        case "expr": {
            const ret = tcExpr(s.expr, functions, variables);
            return { ...s, expr: ret };
        }
        case "return": {
            const valTyp = tcExpr(s.value, functions, variables);
            if(valTyp.a !== currentReturn) {
                throw new TypeError(`${valTyp.a} returned but ${currentReturn} expected.`);
            }
            return { ...s, value: valTyp };
        }
    }
}

export function checkDefinition(p : Stmt<any>[]) {
    var LastDeclare = -1;
    var firstStmt = p.length;
    for(var i = 0; i < p.length; i ++) {
        if ((p[i].tag === "assign" && (p[i] as {var: TypeDef}).var.type != undefined) || p[i].tag == "func") {
            LastDeclare = i;
        } else {
            firstStmt = i;
        }

        if (LastDeclare > firstStmt) {
            throw new Error("Can not define variable and func after")
        }
    }
}


export function tcProgram(p : Stmt<any>[]) : Stmt<Type>[] {
    var functions: FunctionsEnv = [];
    var variables: VariablesEnv = [];

    functions = enterNewFunctionScope(functions);
    variables = enterNewVariableScope(variables);
    
    // check if all definition are proceeding statements
    checkDefinition(p);
    // define all the functions and variables
    p.forEach(s => {
        if (s.tag == "func") defineNewFunc(functions, s.name, [s.params.map(p => p.type), s.ret]);
        else if (s.tag == "var") defineNewVar(variables, s.var.name, s.var.type);
    })

    return p.map(s => {
        const res = tcStmt(s, functions, variables, Primitive.None);
        return res;
    });
}