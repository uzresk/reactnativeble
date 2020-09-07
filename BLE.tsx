import React from 'react'
import BleManager, {Peripheral, PeripheralInfo} from 'react-native-ble-manager'
import {
    Button,
    FlatList,
    NativeEventEmitter,
    NativeModules,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ListRenderItemInfo
} from 'react-native'
import {convertString} from "convert-string"
import Buffer from "buffer"

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter: NativeEventEmitter = new NativeEventEmitter(BleManagerModule)

const styles = StyleSheet.create({
    container: {
        flex: 5,

    },
    peripheral: {
        lineHeight: 30,
        fontSize: 14
    }
})

export interface Props {

}

interface State {
    bt_status: string,
    bt_connect_peripheral: string,
    peripheralList: Array<Peripheral>,
    peripheralIds: Array<string>
}

class BLE extends React.Component<Props, State> {

    constructor(props: Props) {
        super(props)
        this.state = {
            bt_status: 'on',
            bt_connect_peripheral: '',
            peripheralList: [],
            peripheralIds: []
        }
    }

    // state = {
    //     bt_status: 'on',
    //     bt_connect_peripheral: '',
    //     peripheralList: [],
    //     peripheralIds: []
    // }

    componentDidMount() {
        BleManager.start({showAlert: false})
            .then(() => {
                console.log('BleManager initialized')
                this.setState({peripheralList: [], peripheralIds: []})
                // this.state.peripheralList = []
                // this.state.peripheralIds = []; // peripheralidの重複チェックに利用

                // bluetoothのステータスが変わったときのlistenerを登録(<-> checkstate)
                bleManagerEmitter.addListener(
                    'BleManagerDidUpdateState',
                    (args) => {
                        this.setState({bt_status: args.state})
                    }
                );


                // scanできたときのlistenerを登録
                bleManagerEmitter.addListener(
                    'BleManagerDiscoverPeripheral',
                    (args: {}) => {
                        const discoverPeripheral = args as Peripheral;
                        if (discoverPeripheral.name !== null) {
                            if (this.state.peripheralList.length === 0 ||
                                this.state.peripheralIds.indexOf(discoverPeripheral.id) === -1) {
                                console.log(discoverPeripheral)
                                this.state.peripheralIds.push(discoverPeripheral.id);
                                this.state.peripheralList.push(discoverPeripheral);
                                this.setState({peripheralList: this.state.peripheralList})
                            }
                        }
                    }
                );

                bleManagerEmitter.addListener(
                    "BleManagerDidUpdateValueForCharacteristic",
                    (data) => {
                        // Convert bytes array to string
                        const value = convertString.bytesToString(data.value);
                        console.log(`Recieved ${value} for characteristic ${data.characteristic}`);
                    }
                );

                // connectできたときのlistenerを登録
                bleManagerEmitter.addListener(
                    'BleManagerConnectPeripheral',
                    (args) => {
                        const peripheralId = args.peripheral

                        // connectされたperipheral idをstateに登録
                        console.log(`connect[${peripheralId}]`);
                        this.setState({bt_connect_peripheral: peripheralId})

                        // サービスを取得してみる
                        BleManager.retrieveServices(args.peripheral)
                            .then((peripheralInfo) => {
                                console.log("retrieve services.")
                                // console.log(peripheralInfo);
                                // @ts-ignore
                                for (let item of peripheralInfo.characteristics) {
                                    console.log(`[${item.service}][${item.characteristic}]`);
                                    console.log(`    Properties: ${JSON.stringify(item.properties)}`)
                                    console.log(`    Descriptors: ${JSON.stringify(item.descriptors)}`)
                                }

                                // device nameのREAD
                                // readはretrieveServicesの後ろにないとダメ。
                                // let prefix = '0000'
                                // let suffix = '-0000-1000-8000-00805f9b34fb'
                                // BleManager.read(peripheralId, prefix + '1800' + suffix, prefix + '2a00' + suffix)
                                BleManager.read(peripheralId, '1800', '2a00')
                                    .then((readData) => {
                                        const buffer = Buffer.Buffer.from(readData)
                                        // const sensorData = buffer.readUInt8(1, true);
                                        const sensorData = buffer.toString();
                                        console.log("DeviceName:" + sensorData);
                                    })
                            })
                            .catch((error) => {
                                console.log(error);
                            })
                    }
                )

                // disconnectされたときに呼ばれるListener(<->disconnect)
                bleManagerEmitter.addListener(
                    'BleManagerDisconnectPeripheral',
                    (args) => {
                        console.log("disconnect[" + args.peripheral + "]");
                        this.setState({bt_connect_peripheral: ''})
                    }
                );

                BleManager.checkState();
            }).catch((error) => {
            console.log(error);
        });
    }

    scan() {
        BleManager.scan([], 3, false)
            .then(() => {
                console.log('Scan started');
                this.setState({peripheralList: []});
            })
            .catch((error) => {
                console.log(error);
            });
    }

    connect(peripheral: Peripheral) {
        BleManager.connect(peripheral.id)
            .catch((error) => {
                console.log("connect error")
                console.log(error)
            })
    }

    disconnect() {
        console.log("connected pripheralid[" + this.state.bt_connect_peripheral + "]")
        BleManager.disconnect(this.state.bt_connect_peripheral, true)
            .catch((error) => {
                console.log("disconnect error" + error);
            })
    }

    render() {
        return (
            <View style={styles.container}>
                <Text>Bluetooth: {this.state.bt_status}</Text>
                <Button title="Scan" onPress={this.scan.bind(this)}/>
                <FlatList data={this.state.peripheralList}
                          keyExtractor={this.keyGenerator}
                          renderItem={({item}) => this.renderPeripheral(item)}/>
                <Button title={'Disconnect ' + this.state.bt_connect_peripheral + ' '}
                        onPress={this.disconnect.bind(this)}/>
            </View>
        );
    }

    keyGenerator = () => '_' + Math.random().toString(36).substr(2, 9)

    renderPeripheral(item: Peripheral) {
        return (
            // peripheralIDを送る
            <TouchableOpacity onPress={() => this.connect(item)}>
                <Text style={styles.peripheral}>{item.id} ： {item.name}</Text>
            </TouchableOpacity>
        );
    }
}

export default BLE;