class MyPromise {
    constructor(executor) {
        // Promise的构造函数参数必须是函数，否则报错
        if (typeof executor !== "function") {
            throw new TypeError(`Promise resolver ${executor} is not a function`);
        }

        this.initValue();
        this.initBind();

        try {
            executor(this.resolve, this.reject);
        } catch (e) {
            // 回调函数内部跑出的错误也可以用 reject接收
            this.reject(e);
        }
    }

    // 内部参数初始化
    initValue() {
        this.value = null; // 值
        this.reason = null; //据因
        this.state = MyPromise.PENDING; // 初始状态
        this.OnFulfilledCallbacks = []; // OnFulfilled 的异步执行回调函数
        this.OnRejectedCallbacks = []; //  OnRejected 的异步执行回调函数
    }

    // 将 resolve 及 reject 函数的作用域从执行回调函数内转换到对应 Promise 实例中
    initBind() {
        this.resolve = this.resolve.bind(this);
        this.reject = this.reject.bind(this);
    }

    // resolve 函数执行，state 变为 FULFILLED
    resolve(value) {
        this.state = MyPromise.FULFILLED;
        this.value = value;
        this.OnFulfilledCallbacks.forEach(cb => cb(this.value));
    }

    // reject 函数执行，state 变为 REJECTED
    reject(reason) {
        this.state = MyPromise.REJECTED;
        this.reason = reason;
        this.OnRejectedCallbacks.forEach(cb => cb(this.reason));
    }

    then(OnFulfilled, OnRejected) {
        if (typeof OnFulfilled !== "function") {
            // 如果 OnFulfilled 不是函数或者为空就支持链式调用 .then().then()
            OnFulfilled = function (value) {
                return value;
            }
        }

        if (typeof OnRejected !== "function") {
            OnRejected = function (reason) {
                throw reason;
            }
        }

        let promise2 = new MyPromise((resolve, reject) => {
            // promise 执行成功后回调
            if (this.state === MyPromise.FULFILLED) {
                setTimeout(() => {
                    // 上一个 Promise回调函数返回的值交给下一个 Promise调用
                    try {
                        const x = OnFulfilled(this.value);
                        MyPromise.resolveMyPromise(promise2, x, resolve, reject);
                    } catch (e) {
                        reject(e);
                    }
                })
            }

            // promise 执行失败后回调
            if (this.state === MyPromise.REJECTED) {
                setTimeout(() => {
                    try {
                        const x = OnRejected(this.reason);
                        MyPromise.resolveMyPromise(promise2, x, resolve, reject);
                    } catch (e) {
                        reject(e);
                    }
                })
            }

            // 异步执行函数状态为 Pending 时的处理
            if (this.state === MyPromise.PENDING) {

                this.OnFulfilledCallbacks.push(
                    (value) => setTimeout(() => {
                        try {
                            const x = OnFulfilled(value);
                            MyPromise.resolveMyPromise(promise2, x, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    }));

                this.OnRejectedCallbacks.push(
                    (reason) => setTimeout(() => {
                        try {
                            const x = OnRejected(reason);
                            MyPromise.resolveMyPromise(promise2, x, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    }));
            }
        });
        return promise2;
    }

}

MyPromise.PENDING = "Pending";
MyPromise.FULFILLED = "Fulfilled";
MyPromise.REJECTED = "Rejected";

MyPromise.resolveMyPromise = function (promise2, x, resolve, reject) {
    // 循环调用 thenable 方法时只调用一次
    let called = false;

    // 如果 promise2 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise
    if (x === promise2) {
        reject(new new TypeError("cannot return the same promise object from onfulfilled or on rejected callback."))
    }

    // x 为 Promise
    if (x instanceof MyPromise) {
        // 如果 x 为 Promise ，则使 promise 接受 x 的状态
        // 如果 x 处于执行态，用相同的值执行 promise
        // 如果 x 处于拒绝态，用相同的据因拒绝 promise
        x.then(y => {
            MyPromise.resolveMyPromise(promise2, y, resolve, reject);
        }, r => {
            reject(r);
        })
    }
    // 如果 x 为对象或者函数 (x !== null 避免null也为object)
    else if ((x !== null && typeof x === "object") || typeof x === "function") {
        try { // 防止调用 then 的 getter 方法调用抛出异常
            // 把 x.then 赋值给 then
            const then = x.then;
            // 如果 then 是函数，将 x 作为函数的作用域 this 调用之。
            // 传递两个回调函数作为参数，第一个参数叫做 resolvePromise ，第二个参数叫做 rejectPromise:
            if (typeof then === "function") {
                then.call(x, y => {
                    // 如果 resolvePromise 和 rejectPromise 均被调用，
                    // 或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
                    if (called) return;
                    called = true;
                    MyPromise.resolveMyPromise(promise2, y, resolve, reject);
                }, r => {
                    if (called) return;
                    called = true;
                    reject(r);
                })
            } else {
                if (called) return;
                called = true;
                resolve(x);
            }
            // 
        } catch (e) {
            if (called) return;
            called = true;
            reject(e);
        }
    } else {
        // 如果不是 MyPromise 或者不是具有 thenable 的类及方法，就直接传入 x 数据
        resolve(x);
    }
}

MyPromise.deferred = function () {
    const defer = {}
    defer.promise = new MyPromise((resolve, reject) => {
        defer.resolve = resolve
        defer.reject = reject
    })
    return defer
}

module.exports = MyPromise;
