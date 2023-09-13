import mediasoup from "mediasoup-client";
import { v4 as uuidV4 } from "uuid";



(function () {
  function r(e, n, t) {
    function o(i, f) {
      if (!n[i]) {
        if (!e[i]) {
          var c = "function" == typeof require && require;
          if (!f && c) return c(i, !0);
          if (u) return u(i, !0);
          var a = new Error("Cannot find module '" + i + "'");
          throw ((a.code = "MODULE_NOT_FOUND"), a);
        }
        var p = (n[i] = { exports: {} });
        e[i][0].call(
          p.exports,
          function (r) {
            var n = e[i][1][r];
            return o(n || r);
          },
          p,
          p.exports,
          r,
          e,
          n,
          t
        );
      }
      return n[i].exports;
    }
    for (
      var u = "function" == typeof require && require, i = 0;
      i < t.length;
      i++
    )
      o(t[i]);
    return o;
  }
  return r;
})()(
  {
    1: [
      function (require, module, exports) {
        const mediasoup = "mediasoup-client";
        const { v4: uuidV4 } = "uuid";

        let bntSub;
        let bntCam;
        let bntScreen;
        let textPublish;
        let textWebCam;
        let textScreen;
        let textSubscribe;
        let localVideo;
        let remoteVideo;
        let remoteStream;
        //let device;
        let producer;
        let consumeTransport;
        let userId;
        let isWebCam;
        let produceCallback, produceErrback;
        let consumeCallback, consumerErrback;
        const websocketURL = 'ws://localhost:8000/ws';
        

        let socket, device;

        document.addEventListener("DOMContentLoaded", function () {
          bntCam = document.getElementById("btn_webcam");
          bntScreen = document.getElementById("btn_screen");
          bntSub = document.getElementById("btn_subscribe");
          textWebCam = document.getElementById("webcam_status");
          textScreen = document.getElementById("screen_status");
          textSubscribe = document.getElementById("subscribe_status");
          localVideo = document.getElementById("localVideo");
          remoteVideo = document.getElementById("remoteVideo");

          // button event listener
          bntCam.addEventListener("click", publish);
          bntScreen.addEventListener("click", publish);
          bntSub.addEventListener("click", subscribe);
        });
        // Define getUserMedia function
        async function getUserMedia(transport, isWebCam) {
          try {
            let stream;
            if (isWebCam) {
              stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
              });
            } else {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
              });
            }
            return stream;
          } catch (error) {
            console.error(error);
            throw error;
          }
        }

        // Define loadDevice function
        async function loadDevice(routerRtpCapabilities) {
          try {
            device = new mediasoup.Device();
          } catch (error) {
            if (error.name === "UnsupportedError") {
              console.log("Browser not supported!");
            }
            throw error;
          }

          await device.load({ routerRtpCapabilities });
          return device;
        }

        const connect = () => {
          socket = new WebSocket(websocketURL);
          socket.onopen = () => {
            //start our socket request
            const msg = {
              type: "getRouterRtpCapabilities",
            };
            const resp = JSON.stringify(msg);
            socket.send(resp);
          };

          socket.onmessage = (event) => {
            const jsonValidation = IsJsonString(event.data);
            if (!jsonValidation) {
              console.log("json error");
              return;
            }

            let resp = JSON.parse(event.data);
            switch (resp.type) {
              case "routerCapabilities":
                onRouterCapabilities(resp);
                break;
              case "producerTransportCreated":
                onProducerTransportCreated(resp);
                break;
              case "subTransportCreated":
                onSubTransportCreated(resp);
                break;
              case "resumed":
                console.log(event.data);
                break;
              case "subscribed":
                onSubscribed(resp);
                break;
              default:
                break;
            }
          };
        };
        connect();

        const onSubscribed = async (event) => {
          const { producerId, id, rtpParameters } = event.data;
          let codecOption = {};
          const consumer = await consumeTransport.consume({
            id,
            producerId,
            kind,
            rtpParameters,
            codecOption,
          });
          const stream = new MediaStream();
          stream.addTrack(consumer.track);
          remoteStream = stream;
        };
        const onSubTransportCreated = (event) => {
          if (event.error) {
            console.error("on subtransport create error: ", event.error);
          }
          const transport = device.createRecvTransport(event.data);
          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            const msg = {
              type: "connectConsumerTransport",
              transportId: transport.id,
              dtlsParameters,
            };
            const message = JSON.stringify(msg);
            socket.send(message);
            socket.addEventListener("message", (event) => {
              const jsonValidation = IsJsonString(event.data);
              if (!jsonValidation) {
                console.error("json error");
                return;
              }

              let resp = JSON.parse(event.data);
              if (resp.type === "subConnected") {
                console.log("consumer transport connected!!!");
                callback();
              }
            });
          });
          transport.on("connectionstatechange", async (state) => {
            switch (state) {
              case "connecting":
                textSubscribe.innerHTML = "subscribing....";
                break;
              case "connected":
                remoteVideo.srcObject = remoteStream;
                const msg = {
                  type: "resume",
                };
                const e = (message = JSON.stringify(msg));
                socket.send(message);
                textSubscribe.innerHTML = "subscibed";
                break;
              case "failed":
                transport.close();
                textSubscribe.innerHTML = "failed";
                bntSub.disabled = false;
              default:
                break;
            }
          });
          const stream = consumer(transport);
        };

        const consumer = async (transport) => {
          const { rtpCapabilities } = device;
          const msg = {
            type: "consume",
            rtpCapabilities,
          };
          const message = JSON.stringify(msg);
          socket.send(message);
        };
        const onProducerTransportCreated = async (event) => {
          if (event.error) {
            console.log("producer transport create event: ", event.error);
            return;
          }

          const transport = device.createSendTransport(event.data);
          transport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              const message = {
                type: "connectProducerTransport",
                dtlsParameters,
              };
              const resp = JSON.stringify(message);
              socket.send(resp);
              socket.addEventListener("message", (event) => {
                const jsonValidation = IsJsonString(event.data);
                if (!jsonValidation) {
                  console.error("json error");
                  return;
                }

                let resp = JSON.parse(event.data);
                if (resp.type === "producerConnected") {
                  console.log("got producerConnected!!!");
                  callback();
                }
              });
            }
          );
          // begin transport on producer
          transport.on(
            "produce",
            async ({ kind, rtpParameters }, callback, errback) => {
              const message = {
                type: "produce",
                transportId: transport.id,
                kind,
                rtpParameters,
              };
              const resp = JSON.stringify(message);
              socket.send(resp);
              socket.addEventListener("published", (resp) => {
                callback(resp.data.id);
              });
            }
          );
          // end transport producer
          // connection state change begin
          transport.on("connectionStatechange", (state) => {
            switch (state) {
              case "connecting":
                textPublish.innerHTML = "publishing......";
                break;
              case "connected":
                localVideo.srcObject = stream;
                textPublish.innerHTML = "published";
                break;
              case "failed":
                transport.close();
                textPublish.innerHTML = "failed";
                break;
            }
          });
          // connection state change end
          let stream;
          try {
            stream = await getUserMedia(transport, isWebCam);
            const track = stream.getVideoTracks()[0];
            const params = { track };
          } catch (error) {
            console.error(error);
            textPublish.innerHTML = "failed!";
          }

          const onRouterCapabilities = (resp) => {
            loadDevice(resp.data);
            bntCam.disabled = false;
            bntScreen.disabled = false;
          };
        };

        const publish = (e) => {
          isWebCam = e.target.id === "btn_webcam";
          textPublish = isWebCam ? textWebCam : textScreen;
          bntScreen.disabled = true;
          bntCam.disabled = true;

          const message = {
            type: "createProductionTransport",
            forceTcp: false,
            rtpCapabilities: device.rtpCapabilities,
          };

          const resp = JSON.stringify(message);
          socket.send(resp);
        };

        const subscribe = () => {
          bntSub.disabled = true;
          const msg = {
            type: "createConsumerTransport",
            forceTcp: false,
          };
          const message = JSON.stringify(msg);
          socket.send(message);
        };

        const IsJsonString = (str) => {
          try {
            JSON.parse(str);
          } catch (error) {
            return false;
          }
          return true;
        };

        const loadDevice = async (routerRtpCapabilities) => {
          try {
            device = new mediasoup.Device();
          } catch (error) {
            if (error.name === "UnsupportedError") {
              console.log("browser not supported!");
            }
          }
          await device.loadDevice({ routerRtpCapabilities });
        };
        const getUserMedia = async (transport, isWebCam) => {
          if (!device.canProduce("video")) {
            console.error("cannot produce video");
            return;
          }
          let stream;
          try {
            stream = isWebCam
              ? await navigator.mediaDevices.getDisplayMedia({
                  video: true,
                  audio: true,
                })
              : await navigator.mediaDevices.getDisplayMedia({ video: true });
          } catch (error) {
            console.error(error);
            throw error;
          }
          return stream;
        };
      },
      {},
    ],
  },
  {},
  [1]
);
